// Preguntas del "desafío bonus" que se asignan aleatoriamente a un equipo en una
// de sus postas. Si `answer` es undefined, se acepta cualquier respuesta no vacía.
// Si tiene `|`, se acepta cualquiera de las variantes separadas por "|" (la
// comparación ignora mayúsculas y acentos).
export type SeedQuestion = { text: string; answer?: string };

export const QUESTIONS: SeedQuestion[] = [
  {
    text: "¿Llano o rizo sirve para unir cuerdas de diferente o mismo grosor?",
    answer: "mismo",
  },
  {
    text: "¿Vuelta escota sirve para unir cuerdas de diferente o mismo grosor?",
    answer: "diferente",
  },
  {
    text: "¿Valores scout?",
    answer: "lealtad|abnegacion|pureza",
  },
  {
    text: "¿Siglas del fundador del escultismo?",
    answer: "bp",
  },
  {
    text: "¿Flor que representa el escultismo?",
    answer: "lis",
  },
  {
    text: "Mejor Jefe del campamento",
  },
  {
    text: "Sabor de helado favorito del Jefe Negro",
  },
  {
    text: "¿Cuántas fotos al día quita la Jefa Marta?",
  },
  {
    text: "¿Cuántos centímetros de barba fue el récord que consiguió el Jefe Dany?",
  },
  {
    text: "¿Cuántas pizzas del Jefe Aldo podés consumir sin ir a IPS?",
  },
  {
    text: "¿Cuántas cuadras puede caminar la Jefa Ada sin utilizar lentes?",
  },
];

export function randomQuestion(): SeedQuestion {
  return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}
