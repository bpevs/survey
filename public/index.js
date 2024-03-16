async function deleteSurvey(id) {
  await fetch('/survey/' + id, { method: 'DELETE' })
  location.reload()
}

const form = document.getElementById('put-form')

if (form) {
  form.addEventListener('submit', async function putSurvey(e) {
    e.preventDefault()
    const formData = new FormData(form)
    const surveyId = formData.get('survey-id')

    const body = new URLSearchParams()
    body.append('title', formData.get('title'))
    body.append('template', formData.get('template'))
    body.append('userId', formData.get('user-id'))

    await fetch('/survey/' + surveyId, { method: 'PUT', body })
  })
}
