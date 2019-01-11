import * as d3 from "d3";
import { Axis, BaseType, easeLinear, ScaleLinear } from "d3";
import { DataSource, ICountry, years } from "./DataSource";

export class ScatterPlot {
    private readonly svg: d3.Selection<SVGGElement, {}, HTMLElement, any>;
    private readonly tooltip: d3.Selection<HTMLDivElement, {}, HTMLElement, any>;

    private data: DataSource;
    private selection = new Set<ICountry>();

    private readonly margin = { top: 20, right: 20, bottom: 30, left: 40 };
    private readonly width = 960 - this.margin.left - this.margin.right;
    private readonly height = 500 - this.margin.top - this.margin.bottom;
    private nextYear = years[0];
    private readonly yScale: ScaleLinear<number, number>;
    private readonly yAxis: Axis<{valueOf(): number; }>;
    private readonly xScale: ScaleLinear<number, number>;
    private readonly xAxis: Axis<{valueOf(): number; }>;
    private readonly color = d3.scaleOrdinal(d3.schemeCategory10);
    private readonly unselectedOpacity = 0.3;
    // event subscribers
    private onSelectChange: Array<(countrySelection: ICountry[]) => void> = [];

    constructor(container: d3.Selection<d3.BaseType, {}, HTMLElement, any>, dataSource: DataSource) {
        this.data = dataSource;

        let heightAttr = container.attr("data-chart-height");
        let widthAttr = container.attr("data-chart-width");
        if (heightAttr === null || widthAttr === null) {
            heightAttr = "500";
            widthAttr = "960";
        }

        this.width = Number.parseInt(widthAttr) - this.margin.left - this.margin.right;
        this.height = Number.parseInt(heightAttr) - this.margin.top - this.margin.bottom;

        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.xAxis = d3.axisBottom(this.xScale);
        this.yScale = d3.scaleLinear().range([this.height, 0]);
        this.yAxis = d3.axisLeft(this.yScale);

         // add the graph canvas to the body of the webpage
        this.svg = container.append("svg")
         .attr("width", this.width + this.margin.left + this.margin.right)
         .attr("height", this.height + this.margin.top + this.margin.bottom)
         .append("g")
         .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        // add the tooltip area to the webpage
        this.tooltip = container.append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        const limits = this.data.getStatLimits();

        // don't want dots overlapping axis, so add in buffer to data domain
        this.xScale.domain([limits.ineqComb.min * 0.9, limits.ineqComb.max * 1.1]);
        this.yScale.domain([limits.gdp.min * 0.9, limits.gdp.max * 1.1]);

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

        this.animateScatterPlot();

        // draw legend
        const legend = this.svg.selectAll(".legend")
            .data(this.color.domain())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => "translate(0," + i * 20 + ")");

        // draw legend colored rectangles
        legend.append("rect")
            .attr("x", this.width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", this.color);

        // draw legend text
        legend.append("text")
            .attr("x", this.width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text((country) => country);
    }

    public animateScatterPlot(year?: string) {
        if (year !== undefined) {
            this.nextYear = year;
        }

        this.updateScatterPlot(this.data.getCountries());
        console.log("Updating graph for " + this.nextYear);

        const nextIndex = (years.indexOf(this.nextYear) + 1) % years.length;
        this.nextYear = years[nextIndex];
    }

    public subscribeOnSelectionChanged(listener: (selection: ICountry[]) => void) {
        this.onSelectChange.push(listener);
    }

    /*
    * value accessor - returns the value to encode for a given data object.
    * scale - maps value to a visual display encoding, such as a pixel position.
    * map function - maps from data value to display value
    * axis - sets up axis
    */
    // setup x
    private readonly xValue = (country: ICountry) => country.stats.get(this.nextYear).inequality.combined;
    private readonly xMap = (country: ICountry) => this.xScale(this.xValue(country));

    // setup y
    private readonly yValue = (country: ICountry) => country.stats.get(this.nextYear).gdp;
    private readonly yMap = (country: ICountry) => this.yScale(this.yValue(country));

    // setup fill color
    private readonly cValue = (country: ICountry) => country.region;

    private updateScatterPlot(data: ICountry[]) {
        const graph = this.svg.selectAll(".dot")
            .data(data);
        // Update
        this.updateDots(graph);

        // Enter
        this.addDots(graph.enter().append("circle"));

        graph.exit().remove();
    }

    private addDots(selection: d3.Selection<SVGCircleElement | BaseType, ICountry, SVGGElement, {}>) {
        selection
        .attr("cx", this.xMap)
        .attr("cy", this.yMap)
        .attr("class", "dot")
        .attr("r", 3.5)
        .style("fill", (country) => this.color(this.cValue(country)))
        .style("opacity", (country) => {
            if (this.selection.has(country) || this.selection.size === 0) {
                // Item is selected or there is not selection
                return 1;
            } else {
                return this.unselectedOpacity;
            }
        })
        .on("mouseover", (country) => {
            this.tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            this.tooltip.html(country.name + "<br/> (" + this.xValue(country)
                + ", " + this.yValue(country) + ")")
                .style("left", (d3.event.pageX + 5) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            this.tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", (country) => {
            if (this.selection.has(country)) {
                this.selection.delete(country);
            } else {
                this.selection.add(country);
            }

            this.onSelectChange.forEach((h) => h(Array.from(this.selection)));

            this.svg.selectAll(".dot").data(this.data.getCountries())
                .style("opacity", (c) => {
                    if (this.selection.has(c) || this.selection.size === 0) {
                        // Item is selected or there is not selection
                        return 1;
                    } else {
                        return this.unselectedOpacity;
                    }
                });
        });
    }

    private updateDots(selection: d3.Selection<SVGCircleElement | BaseType, ICountry, SVGGElement, {}>) {
        selection
            .transition()
            .duration(1000)
            .ease(easeLinear)
                .attr("cx", this.xMap)
                .attr("cy", this.yMap);
    }
}
