import { ScatterPlot } from "./ScatterPlot";
import { select } from "d3-selection";
import { DataSource } from "./DataSource";
import { LineChart } from "./LineChart";

let plot: ScatterPlot;
let chart1: LineChart;
DataSource.loadData().then((data) => {
    plot = new ScatterPlot(select("#plot"), data);
    plot.subscribeOnSelectionChanged(country => {
        chart1 = new LineChart(select("#chart1"), country[0], data.getStatLimits());
    });
    //setInterval(() => plot.animateScatterPlot(), 1000)
}).catch(err => console.error(err));
