const kv = await Deno.openKv()

type SurveyId = string
type UserId = string

interface Survey {
  userId: UserId
  surveyId: SurveyId
  title: string
  template: string
}

export async function listSurveys(userId: UserId): Promise<Survey[]> {
  const iter = kv.list<User>({ prefix: ['surveys_by_user_id', userId] })
  const surveys = []
  for await (const { value } of iter) {
    surveys.push(value)
  }
  return surveys
}

export async function createSurvey(
  userId: UserId,
  title: string,
  template: string,
): Promise<SurveyId> {
  const surveyId = crypto.randomUUID()
  const survey: Survey = { surveyId, userId, title, template }

  const primaryKey = ['surveys', surveyId]
  const byUserId = ['surveys_by_user_id', userId, surveyId]
  await kv.atomic()
    .check({ key: primaryKey, versionstamp: null })
    .set(primaryKey, survey)
    .set(byUserId, survey)
    .commit()

  return surveyId
}

export async function readSurvey(surveyId: SurveyId): Promise<Survey | void> {
  const response = await kv.get<Survey>(['surveys', surveyId])
  return response.value
}

export async function updateSurvey(
  userId: UserId,
  surveyId: SurveyId,
  title: string,
  template: string,
): Promise<SurveyId> {
  const survey: Survey = { surveyId, userId, title, template }
  let res = { ok: false }

  while (!res.ok) {
    const getRes = await kv.get<Survey>(['surveys', surveyId])
    if (getRes.value?.userId && (getRes.value?.userId !== userId)) return

    res = await kv.atomic()
      .check(getRes)
      .set(['surveys', surveyId], survey)
      .set(['surveys_by_user_id', userId, surveyId], survey)
      .commit()
  }
}

export async function deleteSurvey(
  userId: string,
  surveyId: string,
): Promise<void> {
  let res = { ok: false }
  while (!res.ok) {
    const getRes = await kv.get<Survey>(['surveys', surveyId])
    if (getRes.value?.userId && (getRes.value?.userId !== userId)) return

    res = await kv.atomic()
      .check(getRes)
      .delete(['surveys', surveyId])
      .delete(['surveys_by_user_id', userId, surveyId])
      .commit()
  }
}

export async function answerSurvey(
  id: UserId,
  response: SurveyResponse,
): Promise<SurveyId> {
}
