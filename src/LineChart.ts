import { easeLinear, line } from "d3";
import { axisBottom, axisLeft, axisRight } from "d3-axis";
import { scaleLinear } from "d3-scale";
import { ICountry, ICountryStats, StatLimits, years } from "./DataSource";

interface IYearStats {year: string; stats: ICountryStats; }

export class LineChart {
    private readonly svg: d3.Selection<SVGGElement, {}, HTMLElement, any>;

    private readonly margin = { top: 20, right: 50, bottom: 30, left: 40 };
    private readonly width = 960 - this.margin.left - this.margin.right;
    private readonly height = 500 - this.margin.top - this.margin.bottom;

    private data: IYearStats[] = [];
    private country: ICountry;
    private readonly yScale = scaleLinear().range([this.height, 0]);
    private readonly yAxis = axisLeft(this.yScale);
    private readonly y2Scale = scaleLinear().range([this.height, 0]);
    private readonly y2Axis = axisRight(this.y2Scale);
    private readonly xScale = scaleLinear().range([0, this.width]);
    private readonly xAxis = axisBottom(this.xScale);

    // setup line
    private readonly lineIneq = line<IYearStats>()
        .x((stat) => this.xMap(stat))
        .y((stat) => this.yMap(stat));

    private readonly lineGdp = line<IYearStats>()
        .x((stat) => this.xMap(stat))
        .y((stat) => this.y2Map(stat));

    constructor(container: d3.Selection<d3.BaseType, {}, HTMLElement, any>, dataSource: ICountry, limits: StatLimits) {
         // add the graph canvas to the body of the webpage
         this.svg = container.append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

         limits = new StatLimits();
         for (const year of dataSource.stats) {
            limits.gdp.expandRange(year[1].gdp);
            limits.ineqComb.expandRange(year[1].inequality.combined);
        }
        // don't want dots overlapping axis, so add in buffer to data domain
         this.xScale.domain([Number.parseInt(years[0]) - 1, Number.parseInt(years[years.length - 1]) + 1]);
         this.yScale.domain([limits.ineqComb.min * 0.9, limits.ineqComb.max * 1.1]);
         this.y2Scale.domain([limits.gdp.min * 0.9, limits.gdp.max * 1.1]);

        // x-axis
         this.svg
            .append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + this.height + ")")
            .call(this.xAxis)
            .append("text")
            .attr("class", "label")
            .attr("x", this.width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("Calories");

        // y-axis
         this.svg
            .append("g")
            .attr("class", "y axis")
            .call(this.yAxis)
            .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Protein (g)");

        // y-axis
         this.svg
            .append("g")
            .attr("class", "y axis")
            .attr("transform", "translate(" + this.width + ", 0)")
            .call(this.y2Axis)
            .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Protein (g)");

         this.svg
            .append("path")
            .attr("class", "line gdp");

         this.svg
            .append("path")
            .attr("class", "line ineq");

         this.setCountry(dataSource);
    }

    public setCountry(country: ICountry) {
        this.country = country;
        this.data = [];
        for (const year of country.stats) {
            this.data.push({year: year[0], stats: year[1]});
        }

        this.updateChart();
    }
    /*
    * value accessor - returns the value to encode for a given data object.
    * scale - maps value to a visual display encoding, such as a pixel position.
    * map function - maps from data value to display value
    * axis - sets up axis
    */
    // setup y
    private readonly yValue = (stats: IYearStats) => stats.stats.inequality.combined;
    private readonly yMap = (stats: IYearStats) => this.yScale(this.yValue(stats));

    // setup second y axis
    private readonly y2Value = (stats: IYearStats) => stats.stats.gdp;
    private readonly y2Map = (stats: IYearStats) => this.y2Scale(this.y2Value(stats));

    // setup x axis
    private readonly xValue = (stats: IYearStats) => Number.parseInt(stats.year);
    private readonly xMap = (stats: IYearStats) => this.xScale(this.xValue(stats));

    private updateChart() {
        const graph = this.svg.selectAll(".dot")
            .data(this.data);

        graph
            .transition()
            .duration(200)
            .ease(easeLinear)
                .attr("cx", this.xMap)
                .attr("cy", this.yMap);

        graph.enter().append("circle")
            .attr("class", "dot")
            .attr("cx", this.xMap)
            .attr("cy", this.yMap)
            .attr("r", 5);

        graph.exit().remove();

        this.svg.select(".line.ineq")
            .datum(this.data)
            .attr("d", this.lineIneq);

        this.svg.select(".line.gdp")
            .datum(this.data)
            .attr("d", this.lineGdp);
    }
}
