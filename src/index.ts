import "bootstrap";
import { select } from "d3-selection";
import { DataSource, ICountry, ICountryStats, StatValue } from "./DataSource";
import { LineChart } from "./LineChart";
import { ScatterPlot } from "./ScatterPlot";

let plot: ScatterPlot;
let chart1: LineChart;

DataSource.loadData().then((data) => {
    plot = new ScatterPlot(select("#plot"), data);
    plot.subscribeOnSelectionChanged((country) => {
        if (country.length !== 0) {
            const selectedCountries = new Map(
                country.map<[ICountry, Map<StatValue, Array<{year: string, value: number}>>]>(
                    (c) => [c, data.getCountryStats(c)]));
            if (chart1) {
                chart1.setCountries(selectedCountries);
            } else {
                chart1 = new LineChart(select("#chart1"), selectedCountries);
                select("#reset-selection")
                    .classed("d-none", false)
                    .on("click", () => {
                        plot.setSelection([]);
                    });
            }
        }
    });

    // Create a chart each frame to not lag on load
    const createChart = (queue: ICountry[]) => {
        const country = queue.shift();
        const chart = new LineChart(
            select("#charts"),
            new Map([[country, data.getCountryStats(country)]]));
        if (queue.length > 0) {
            setTimeout(() => createChart(queue), 0);
        }
    };
    createChart(data.getCountries());

    // setInterval(() => plot.animateScatterPlot(), 1000)
}).catch((err) => console.error(err));

select("#Nummer01").on("click", () => {
   plot.setSelectionByName(["Germany", "France"]);
});
