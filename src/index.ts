import { select } from "d3-selection";
import { DataSource } from "./DataSource";
import { LineChart } from "./LineChart";
import { ScatterPlot } from "./ScatterPlot";

let plot: ScatterPlot;
let chart1: LineChart;
DataSource.loadData().then((data) => {
    plot = new ScatterPlot(select("#plot"), data);
    plot.subscribeOnSelectionChanged((country) => {
        if (country.length !== 0) {
            if (chart1) {
                chart1.setCountry(country[0]);
            } else {
                chart1 = new LineChart(select("#chart1"), country[0], data.getStatLimits());
            }
        }
    });
    for (const country of data.getCountries()) {
        const chart = new LineChart(select("#charts"), country, data.getStatLimits());
    }
    // setInterval(() => plot.animateScatterPlot(), 1000)
}).catch((err) => console.error(err));
