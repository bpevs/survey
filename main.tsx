/** @jsx jsx */
/** @jsxFrag  Fragment */
import { Hono } from 'https://deno.land/x/hono/mod.ts'
import {
  jsx,
  logger,
  memo,
  poweredBy,
  serveStatic,
} from 'https://deno.land/x/hono@v3.11.11/middleware.ts'
import {
  createGitHubOAuth2Client,
  getSessionAccessToken,
  getSessionId,
  handleCallback,
  signIn,
  signOut,
} from 'https://deno.land/x/deno_kv_oauth@v0.3.0/mod.ts'
import { html } from 'https://deno.land/x/hono/helper.ts'
import { loadSync } from 'https://deno.land/std@0.194.0/dotenv/mod.ts'
import * as db from './db.ts'
import buildForm from './build_form.tsx'

loadSync({ export: true })

const oauthClient = createGitHubOAuth2Client({
  redirectUri: 'http://localhost:8000/callback',
})

type GitHubUser = {
  login: string
  avatar_url: string
  html_url: string
}

async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error()
  }
  return (await response.json()) as GitHubUser
}

const Html = (props: { children?: string }) =>
  html`
  <html>
    <head>
      <link rel="stylesheet" href="/index.css">
    </head>
    <body>
      <main class="sans-serif">
        ${props.children}
      </main>
      <script src="/index.js"></script>
    </body>
  </html>
`

const app = new Hono()

app.use('*', logger(), poweredBy())
app.all('/favicon.ico', serveStatic({ path: './public/favicon.ico' }))
app.all('/index.js', serveStatic({ path: './public/index.js' }))
app.all('/index.css', serveStatic({ path: './public/index.css' }))

app.get('/login', async (c) => {
  const response = await signIn(c.req.raw, oauthClient)
  c.header('set-cookie', response.headers.get('set-cookie')!)
  return c.redirect(response.headers.get('location')!, response.status)
})

app.get('/callback', async (c) => {
  const { response, accessToken } = await handleCallback(
    c.req.raw,
    oauthClient,
  )
  c.header('set-cookie', response.headers.get('set-cookie')!)
  return c.redirect(response.headers.get('location')!, response.status)
})

app.get('/logout', async (c) => {
  const response = await signOut(c.req.raw)
  c.header('set-cookie', response.headers.get('set-cookie')!)
  return c.redirect(response.headers.get('location')!, response.status)
})

app.get('/', async (c) => {
  const sessionId = getSessionId(c.req.raw)
  const isSignedIn = sessionId !== undefined

  if (!isSignedIn) {
    return c.html(
      <Html>
        <a href='/login'>Login</a>
      </Html>,
    )
  }

  const accessToken = isSignedIn
    ? await getSessionAccessToken(oauthClient, sessionId)
    : null
  const user = accessToken ? await getGitHubUser(accessToken) : null
  const surveys = await db.listSurveys(user.login)

  return c.html(
    <Html>
      <header class='bg-black-90 w-100 ph3 pv3 pv4-ns ph4-m ph4-l'>
        <nav class='f6 fw6 ttu tracked'>
          <a class='link dim white dib' href='/logout' title='Logout'>Logout</a>
        </nav>
      </header>

      <details class='ma4'>
        <summary>Create Survey</summary>
        <h1>Create Survey</h1>
        <form action='/survey' method='post' class='pa4 black-80'>
          <div class='measure'>
            <label for='title' class='f6 b db mb2'>
              Title
            </label>
            <input
              required
              id='title'
              name='title'
              class='input-reset ba b--black-20 pa2 mb2 db w-100'
              type='text'
              aria-describedby='title-desc'
            >
            </input>
          </div>

          <div>
            <label for='template' class='f6 b db mb2'>Template</label>
            <textarea
              required
              id='template'
              name='template'
              class='db border-box hover-black w-100 measure ba b--black-20 pa2 br2 mb2'
              aria-describedby='template-desc'
              rows={20}
            >
            </textarea>
          </div>

          <input type='submit'>Submit</input>
        </form>
      </details>

      <div class='pa4 measure'>
        <h1>Active Surveys</h1>
        <ul class='list pl0'>
          {surveys.map((survey) => (
            <li class='lh-copy pv3 ba bl-0 bt-0 br-0 b--dotted b--black-30'>
              <a
                class='f4 fw7 dib pa2 no-underline'
                href={`/survey/${survey.surveyId}`}
              >
                {survey.title}
              </a>
              <button
                class='f6 link dim br3 ba ph3 pv2 mb2 dib black'
                onClick={`deleteSurvey("${survey.surveyId}")`}
              >
                delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Html>,
  )
})

app.get('/:surveyId', async (c) => {
  const surveyId = c.req.param('surveyId')
  if (!surveyId) c.text('No survey Id provided', { status: 400 })
  const survey = await db.readSurvey(surveyId)
  if (!survey) c.text(`No survey exists for id: ${surveyId}`, { status: 404 })
  return c.html(
    <Html>
      {buildForm(survey.template)}
    </Html>,
  )
})

app.post('/survey', async (c) => {
  const { title, template } = await c.req.parseBody()
  const sessionId = getSessionId(c.req.raw)
  const isSignedIn = sessionId !== undefined
  if (!isSignedIn) c.text('Unauthorized', { status: 401 })
  const accessToken = isSignedIn
    ? await getSessionAccessToken(oauthClient, sessionId)
    : null
  const user = accessToken ? await getGitHubUser(accessToken) : null
  await db.createSurvey(user?.login, title, template)
  return c.redirect('/')
})

app.get('/survey/:surveyId', async (c) => {
  const surveyId = c.req.param('surveyId')
  if (!surveyId) c.text('No survey Id provided', { status: 400 })
  const sessionId = getSessionId(c.req.raw)
  const isSignedIn = sessionId !== undefined
  if (!isSignedIn) {
    return c.html(
      <Html>
        <main>
          <a href='/login'>Login</a>
        </main>
      </Html>,
    )
  }
  const accessToken = await getSessionAccessToken(oauthClient, sessionId)
  const user = accessToken ? await getGitHubUser(accessToken) : null
  const survey = await db.readSurvey(surveyId)
  return c.html(
    <Html>
      <header class='bg-black-90 w-100 ph3 pv3 pv4-ns ph4-m ph4-l'>
        <nav class='f6 fw6 ttu tracked'>
          <a class='link dim white dib mr4' href='/logout' title='Logout'>
            Logout
          </a>
          <a class='link dim white dib mr4' href='/' title='Home'>Back</a>
        </nav>
      </header>

      <h1 class='pa4'>Update Survey</h1>
      <form
        id='put-form'
        class='pa4 black-80'
        onSubmit={`(e) => putForm("${user.login}", "${surveyId}", e)`}
      >
        <div class='measure'>
          <label for='title' class='f6 b db mb2'>Title</label>
          <input
            required
            id='title'
            name='title'
            class='input-reset ba b--black-20 pa2 mb2 db w-100'
            type='text'
            value={survey.title}
            aria-describedby='title-desc'
          >
          </input>
        </div>

        <div>
          <label for='template' class='f6 b db mb2'>Template</label>
          <textarea
            required
            id='template'
            name='template'
            class='db border-box hover-black w-100 measure ba b--black-20 pa2 br2 mb2'
            aria-describedby='template-desc'
            rows='30'
          >
            {survey.template}
          </textarea>
        </div>

        <input style='display: none;' name='user-id' value={user.login} />
        <input style='display: none;' name='survey-id' value={surveyId} />

        <input type='submit'>Submit</input>
      </form>
    </Html>,
  )
})

app.put('/survey/:surveyId', async (c) => {
  const surveyId = c.req.param('surveyId')
  const { title, template, userId } = await c.req.parseBody()
  if (!surveyId) c.text('No survey Id provided', { status: 400 })
  const survey = await db.updateSurvey(userId, surveyId, title, template)
  if (!survey) c.text(`No survey exists for id: ${surveyId}`, { status: 404 })
  return c.redirect(`/${surveyId}`)
})

app.delete('/survey/:surveyId', async (c) => {
  const surveyId = c.req.param('surveyId')
  if (!surveyId) c.text('No survey Id provided', { status: 400 })

  const sessionId = getSessionId(c.req.raw)
  const isSignedIn = sessionId !== undefined
  if (!isSignedIn) c.text('Unauthorized', { status: 401 })

  const accessToken = isSignedIn
    ? await getSessionAccessToken(oauthClient, sessionId)
    : null
  const user = accessToken ? await getGitHubUser(accessToken) : null

  await db.deleteSurvey(user.login, surveyId)
  return c.json('file deleted', { status: 200 })
})

Deno.serve(app.fetch)
