export const GROUPS = [
  "alt.atheism",
  "comp.graphics",
  "comp.os.ms-windows.misc",
  "comp.sys.ibm.pc.hardware",
  "comp.sys.mac.hardware",
  "comp.windows.x",
  "misc.forsale",
  "rec.autos",
  "rec.motorcycles",
  "rec.sport.baseball",
  "rec.sport.hockey",
  "sci.crypt",
  "sci.electronics",
  "sci.med",
  "sci.space",
  "soc.religion.christian",
  "talk.politics.guns",
  "talk.politics.mideast",
  "talk.politics.misc",
  "talk.religion.misc",
];

const HUES = {
  alt: 355,
  comp: 215,
  misc: 190,
  rec: 150,
  sci: 275,
  soc: 320,
  talk: 35,
};

export function categoryOf(group) {
  return group.split(".")[0];
}

export function categoryColor(category) {
  return `hsl(${HUES[category] ?? 210} 72% 52%)`;
}

const COLOR_MAP = (() => {
  const byCategory = {};
  GROUPS.forEach((group) => {
    const category = categoryOf(group);
    byCategory[category] = byCategory[category] ?? [];
    byCategory[category].push(group);
  });
  const map = {};
  Object.entries(byCategory).forEach(([category, list]) => {
    list.forEach((group, index) => {
      map[group] = `hsl(${HUES[category] ?? 210} 72% ${40 + index * 8}%)`;
    });
  });
  return map;
})();

export function groupColor(group) {
  return COLOR_MAP[group] ?? categoryColor(categoryOf(group));
}
