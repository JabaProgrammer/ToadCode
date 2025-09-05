export function refinePrompt(prompt: string){
  const open_questions: string[] = [];
  if (!/input|формат|вход/i.test(prompt)) open_questions.push('Уточните формат входных данных');
  if (!/огранич|limit|memory|time/i.test(prompt)) open_questions.push('Есть ли ограничения по времени/памяти?');
  if (!/язык|language|env|окруж/i.test(prompt)) open_questions.push('Какой язык/окружение/версии?');
  if (!/лиценз/i.test(prompt)) open_questions.push('Требования к лицензиям зависимостей?');
  return { goals: [], constraints: [], metrics: [], open_questions };
}
