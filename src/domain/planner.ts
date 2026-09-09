export type PanelPlan = {
  widthMm: number;
  heightMm: number;
  rows: number;
  long: number;
  half: number;
  panels: number;
  midCables: number;
  dataFeeds: number;
  powerFeeds: number;
};
export function panelPlan(
  width: number,
  height: number,
  panelW = 500,
  panelH = 500,
  surface = false,
): PanelPlan {
  if (
    ![width, height, panelW, panelH].every((x) => Number.isFinite(x) && x > 0) ||
    width > 100000 ||
    height > 100000
  )
    throw Error('Anna positiiviset, enintään 100 m mitat.');
  const rows = Math.ceil(height / panelH);
  const cols = Math.ceil(width / (surface ? 500 : panelW));
  const long = surface ? Math.floor(cols / 2) * rows : cols * rows,
    half = surface ? (cols % 2) * rows : 0;
  const panels = long + half;
  return {
    widthMm: cols * (surface ? 500 : panelW),
    heightMm: rows * panelH,
    rows,
    long,
    half,
    panels,
    midCables: Math.ceil((panels + 5) / 10) * 10,
    dataFeeds: rows,
    powerFeeds: rows * ((surface ? Math.ceil(cols / 2) : cols) > 20 ? 2 : 1),
  };
}
