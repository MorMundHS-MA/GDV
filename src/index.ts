import { ScatterPlot } from "./ScatterPlot";
import { select } from "d3-selection";

new ScatterPlot(select('#root'))
    .create()
    .then(plot => setInterval(() => plot.animateScatterPlot(), 1000));