/** @jsx jsx */
/** @jsxFrag  Fragment */
import { parse } from 'https://deno.land/std@0.207.0/toml/mod.ts'
import { jsx } from 'https://deno.land/x/hono@v3.11.11/middleware.ts'

enum Input {
  Radio = 'radio',
  Text = 'text',
  TextArea = 'textarea',
  Date = 'date',
  File = 'file',
  Checkbox = 'checkbox',
  Checkboxes = 'checkboxes',
}

export default function buildForm(text: string) {
  const data = parse(text)
  const components = data.questions.map((def, index) => {
    const { type, prompt, answers, filetypes, maxlength } = def
    if (type === Input.Text || type === Input.Date || type === Input.File) {
      return (
        <div class='measure mv3'>
          <label for={index} class='f6 b db mb2'>{prompt}</label>
          <input
            type={type}
            name={index}
            class='input-reset ba b--black-20 pa2 mb2 db w-100'
          />
        </div>
      )
    }
    if (type === Input.TextArea) {
      return (
        <div class='mv3'>
          <label for={index} class='f6 b db mb2'>{prompt}</label>
          <textarea
            name={index}
            class='db border-box hover-black w-100 measure ba b--black-20 pa2 br2 mb2'
            maxlength={maxlength}
            aria-describedby='comment-desc'
          />
        </div>
      )
    }
    if (type === Input.Radio) {
      return (
        <fieldset class='bn mv3 pa0'>
          <legend class='fw7 mb2'>{prompt}</legend>
          {answers.map((answer, idx) => (
            <div class='flex items-center mb2'>
              <input class='mr2' type='radio' name={index} value={answer} />
              <label name={index} for={index} class='lh-copy'>{answer}</label>
            </div>
          ))}
        </fieldset>
      )
    }
    if (type === Input.Checkbox) {
      return (
        <div class='mv3'>
          <label name={index} for={index} class='f6 b mb2 mr2'>{prompt}</label>
          <input type='checkbox' name={index} />
        </div>
      )
    }
    if (type === Input.Checkboxes) {
      return (
        <fieldset class='bn mv3 pa0'>
          <legend class='fw7 mb2'>{prompt}</legend>
          {answers.map((answer, idx) => (
            <div class='flex items-center mb2'>
              <input class='mr2' type='checkbox' name={index} />
              <label name={index} for={index} class='lh-copy'>{answer}</label>
            </div>
          ))}
        </fieldset>
      )
    }

    return null
  })

  return (
    <div class='pa5' style='margin: auto;'>
      <h1>{data.meta.title}</h1>
      <p>{data.meta.description}</p>
      <hr />
      <form>
        {components}
      </form>
    </div>
  )
}
