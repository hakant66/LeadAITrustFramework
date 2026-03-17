// app/aireadinesscheck/seed/enablers.ts
export type Theme = { title: string; blue: string; orange: string };
export type Enabler = { id: number; name: string; themes: Theme[] };

export const buildEnablers = (t: (key: string) => string): Enabler[] => [
  {
    id: 1,
    name: t("enablers.items.item0.name"),
    themes: [
      {
        title: t("enablers.items.item0.themes.t0.title"),
        blue: t("enablers.items.item0.themes.t0.blue"),
        orange: t("enablers.items.item0.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item0.themes.t1.title"),
        blue: t("enablers.items.item0.themes.t1.blue"),
        orange: t("enablers.items.item0.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item0.themes.t2.title"),
        blue: t("enablers.items.item0.themes.t2.blue"),
        orange: t("enablers.items.item0.themes.t2.orange"),
      },
    ],
  },
  {
    id: 2,
    name: t("enablers.items.item1.name"),
    themes: [
      {
        title: t("enablers.items.item1.themes.t0.title"),
        blue: t("enablers.items.item1.themes.t0.blue"),
        orange: t("enablers.items.item1.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item1.themes.t1.title"),
        blue: t("enablers.items.item1.themes.t1.blue"),
        orange: t("enablers.items.item1.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item1.themes.t2.title"),
        blue: t("enablers.items.item1.themes.t2.blue"),
        orange: t("enablers.items.item1.themes.t2.orange"),
      },
    ],
  },
  {
    id: 3,
    name: t("enablers.items.item2.name"),
    themes: [
      {
        title: t("enablers.items.item2.themes.t0.title"),
        blue: t("enablers.items.item2.themes.t0.blue"),
        orange: t("enablers.items.item2.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item2.themes.t1.title"),
        blue: t("enablers.items.item2.themes.t1.blue"),
        orange: t("enablers.items.item2.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item2.themes.t2.title"),
        blue: t("enablers.items.item2.themes.t2.blue"),
        orange: t("enablers.items.item2.themes.t2.orange"),
      },
    ],
  },
  {
    id: 4,
    name: t("enablers.items.item3.name"),
    themes: [
      {
        title: t("enablers.items.item3.themes.t0.title"),
        blue: t("enablers.items.item3.themes.t0.blue"),
        orange: t("enablers.items.item3.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item3.themes.t1.title"),
        blue: t("enablers.items.item3.themes.t1.blue"),
        orange: t("enablers.items.item3.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item3.themes.t2.title"),
        blue: t("enablers.items.item3.themes.t2.blue"),
        orange: t("enablers.items.item3.themes.t2.orange"),
      },
    ],
  },
  {
    id: 5,
    name: t("enablers.items.item4.name"),
    themes: [
      {
        title: t("enablers.items.item4.themes.t0.title"),
        blue: t("enablers.items.item4.themes.t0.blue"),
        orange: t("enablers.items.item4.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item4.themes.t1.title"),
        blue: t("enablers.items.item4.themes.t1.blue"),
        orange: t("enablers.items.item4.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item4.themes.t2.title"),
        blue: t("enablers.items.item4.themes.t2.blue"),
        orange: t("enablers.items.item4.themes.t2.orange"),
      },
    ],
  },
  {
    id: 6,
    name: t("enablers.items.item5.name"),
    themes: [
      {
        title: t("enablers.items.item5.themes.t0.title"),
        blue: t("enablers.items.item5.themes.t0.blue"),
        orange: t("enablers.items.item5.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item5.themes.t1.title"),
        blue: t("enablers.items.item5.themes.t1.blue"),
        orange: t("enablers.items.item5.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item5.themes.t2.title"),
        blue: t("enablers.items.item5.themes.t2.blue"),
        orange: t("enablers.items.item5.themes.t2.orange"),
      },
    ],
  },
  {
    id: 7,
    name: t("enablers.items.item6.name"),
    themes: [
      {
        title: t("enablers.items.item6.themes.t0.title"),
        blue: t("enablers.items.item6.themes.t0.blue"),
        orange: t("enablers.items.item6.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item6.themes.t1.title"),
        blue: t("enablers.items.item6.themes.t1.blue"),
        orange: t("enablers.items.item6.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item6.themes.t2.title"),
        blue: t("enablers.items.item6.themes.t2.blue"),
        orange: t("enablers.items.item6.themes.t2.orange"),
      },
    ],
  },
  {
    id: 8,
    name: t("enablers.items.item7.name"),
    themes: [
      {
        title: t("enablers.items.item7.themes.t0.title"),
        blue: t("enablers.items.item7.themes.t0.blue"),
        orange: t("enablers.items.item7.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item7.themes.t1.title"),
        blue: t("enablers.items.item7.themes.t1.blue"),
        orange: t("enablers.items.item7.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item7.themes.t2.title"),
        blue: t("enablers.items.item7.themes.t2.blue"),
        orange: t("enablers.items.item7.themes.t2.orange"),
      },
    ],
  },
  {
    id: 9,
    name: t("enablers.items.item8.name"),
    themes: [
      {
        title: t("enablers.items.item8.themes.t0.title"),
        blue: t("enablers.items.item8.themes.t0.blue"),
        orange: t("enablers.items.item8.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item8.themes.t1.title"),
        blue: t("enablers.items.item8.themes.t1.blue"),
        orange: t("enablers.items.item8.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item8.themes.t2.title"),
        blue: t("enablers.items.item8.themes.t2.blue"),
        orange: t("enablers.items.item8.themes.t2.orange"),
      },
    ],
  },
  {
    id: 10,
    name: t("enablers.items.item9.name"),
    themes: [
      {
        title: t("enablers.items.item9.themes.t0.title"),
        blue: t("enablers.items.item9.themes.t0.blue"),
        orange: t("enablers.items.item9.themes.t0.orange"),
      },
      {
        title: t("enablers.items.item9.themes.t1.title"),
        blue: t("enablers.items.item9.themes.t1.blue"),
        orange: t("enablers.items.item9.themes.t1.orange"),
      },
      {
        title: t("enablers.items.item9.themes.t2.title"),
        blue: t("enablers.items.item9.themes.t2.blue"),
        orange: t("enablers.items.item9.themes.t2.orange"),
      },
    ],
  },
];
