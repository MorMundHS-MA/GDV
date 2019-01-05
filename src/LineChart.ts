import { Country, CountryStats, StatLimits, years } from "./DataSource";
import { scaleLinear } from "d3-scale";
import { axisBottom, axisLeft, axisRight } from "d3-axis";
import { line, easeLinear } from "d3";

type YearStats = {year: string, stats: CountryStats};

export class LineChart {
    private readonly svg: d3.Selection<SVGGElement, {}, HTMLElement, any>;

    private readonly margin = { top: 20, right: 50, bottom: 30, left: 40 };
    private readonly width = 960 - this.margin.left - this.margin.right;
    private readonly height = 500 - this.margin.top - this.margin.bottom;

    private data: YearStats[] = [];
    private country: Country;
    /*
    * value accessor - returns the value to encode for a given data object.
    * scale - maps value to a visual display encoding, such as a pixel position.
    * map function - maps from data value to display value
    * axis - sets up axis
    */
    // setup y
    private readonly yValue = (stats: YearStats) => stats.stats.inequality.combined;
    private readonly yScale = scaleLinear().range([this.height, 0]);
    private readonly yMap = (stats: YearStats) => this.yScale(this.yValue(stats));
    private readonly yAxis = axisLeft(this.yScale);

    // setup second y axis
    private readonly y2Value = (stats: YearStats) => stats.stats.gdp;
    private readonly y2Scale = scaleLinear().range([this.height, 0]);
    private readonly y2Map = (stats: YearStats) => this.y2Scale(this.y2Value(stats));
    private readonly y2Axis = axisRight(this.y2Scale);

    // setup x axis
    private readonly xValue = (stats: YearStats) => Number.parseInt(stats.year);
    private readonly xScale = scaleLinear().range([0, this.width]);
    private readonly xMap = (stats: YearStats) => this.xScale(this.xValue(stats));
    private readonly xAxis = axisBottom(this.xScale);

    // setup line
    private readonly lineIneq = line<YearStats>()
        .x(stat => this.xMap(stat))
        .y(stat => this.yMap(stat));

    private readonly lineGdp = line<YearStats>()
        .x(stat => this.xMap(stat))
        .y(stat => this.y2Map(stat));

    constructor(container: d3.Selection<d3.BaseType, {}, HTMLElement, any>, dataSource: Country, limits: StatLimits) {
         // add the graph canvas to the body of the webpage
         this.svg = container.append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        limits = new StatLimits();
        for (const year of dataSource.stats) {
            limits.gdp.expandRange(year[1].gdp);
            limits.ineq_comb.expandRange(year[1].inequality.combined);
        }
        // don't want dots overlapping axis, so add in buffer to data domain
        this.xScale.domain([Number.parseInt(years[0]) - 1, Number.parseInt(years[years.length - 1]) + 1]);
        this.yScale.domain([limits.ineq_comb.min * 0.9, limits.ineq_comb.max * 1.1]);
        this.y2Scale.domain([limits.gdp.min * 0.9, limits.gdp.max * 1.1])

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
            .text("Protein (g)")

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
            .text("Protein (g)")

        this.svg
            .append("path")
            .attr("class", "line gdp");

        this.svg
            .append("path")
            .attr("class", "line ineq");

        this.setCountry(dataSource);
    }

    public setCountry(country: Country) {
        this.country = country;
        this.data = [];
        for (const year of country.stats) {
            this.data.push({year: year[0], stats: year[1]});
        }

        this.updateChart();
    }

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
