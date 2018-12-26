import { ScatterPlot } from "./ScatterPlot";
import { select } from "d3-selection";
import { DataSource } from "./DataSource";

let plot: ScatterPlot;
DataSource.loadData().then((data) => {
    console.log(data);
    plot = new ScatterPlot(select('#root'), data);
    setInterval(() => plot.animateScatterPlot(), 1000)
}).catch(err => console.error(err));
