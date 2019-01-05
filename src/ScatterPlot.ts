import * as d3 from "d3";
import { BaseType, easeLinear } from "d3";
import { DataSource, years, Country } from "./DataSource";

export class ScatterPlot {
    private readonly svg: d3.Selection<SVGGElement, {}, HTMLElement, any>;
    private readonly tooltip: d3.Selection<HTMLDivElement, {}, HTMLElement, any>;

    private data: DataSource;
    private selection = new Set<Country>();

    private readonly margin = { top: 20, right: 20, bottom: 30, left: 40 };
    private readonly width = 960 - this.margin.left - this.margin.right;
    private readonly height = 500 - this.margin.top - this.margin.bottom;
    private nextYear = years[0];

    /*
    * value accessor - returns the value to encode for a given data object.
    * scale - maps value to a visual display encoding, such as a pixel position.
    * map function - maps from data value to display value
    * axis - sets up axis
    */
    // setup x
    private readonly xValue = (country: Country) => country.stats.get(this.nextYear).inequality.combined;
    private readonly xScale = d3.scaleLinear().range([0, this.width]);
    private readonly xMap = (country: Country) => this.xScale(this.xValue(country));
    private readonly xAxis = d3.axisBottom(this.xScale);

    // setup y
    private readonly yValue = (country: Country) => country.stats.get(this.nextYear).gdp;
    private readonly yScale = d3.scaleLinear().range([this.height, 0]);
    private readonly yMap = (country: Country) => this.yScale(this.yValue(country));
    private readonly yAxis = d3.axisLeft(this.yScale);

    // setup fill color
    private readonly cValue = (country: Country) => country.region;
    private readonly color = d3.scaleOrdinal(d3.schemeCategory10);
    private readonly unselectedOpacity = 0.3;
    // event subscribers
    private onSelectChange: ((countrySelection: Country[]) => void)[] = [];

    constructor(container: d3.Selection<d3.BaseType, {}, HTMLElement, any>, dataSource: DataSource) {
        this.data = dataSource;
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
        this.xScale.domain([limits.ineq_comb.min * 0.9, limits.ineq_comb.max * 1.1]);
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
        var legend = this.svg.selectAll(".legend")
            .data(this.color.domain())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function (d, i) { return "translate(0," + i * 20 + ")"; });

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
            .text(function (d: any) { return d; });
    }

    public animateScatterPlot(year?: string) {
        if(year !== undefined)
            this.nextYear = year;

        this.updateScatterPlot(this.data.getCountries());
        console.log('Updating graph for ' + this.nextYear)

        let nextIndex = (years.indexOf(this.nextYear) + 1) % years.length;
        this.nextYear = years[nextIndex];
    }

    public subscribeOnSelectionChanged(listener: (selection: Country[]) => void) {
        this.onSelectChange.push(listener);
    }

    private updateScatterPlot(data: Country[]) {
        const graph = this.svg.selectAll(".dot")
            .data(data);
        // Update
        this.updateDots(graph);

        //Enter
        this.addDots(graph.enter().append('circle'));

        graph.exit().remove();
    }

    private addDots(selection: d3.Selection<SVGCircleElement | BaseType, Country, SVGGElement, {}>) {
        selection
        .attr("cx", this.xMap)
        .attr("cy", this.yMap)
        .attr("class", "dot")
        .attr("r", 3.5)
        .style("fill", country => this.color(this.cValue(country)))
        .style("opacity", country => {
            if(this.selection.has(country) || this.selection.size === 0) {
                // Item is selected or there is not selection
                return 1;
            } else {
                return this.unselectedOpacity;
            }
        })
        .on("mouseover", country => {
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
        .on("click", country => {
            if(this.selection.has(country)) {
                this.selection.delete(country);
            } else {
                this.selection.add(country);
            }

            this.onSelectChange.forEach(h => h(Array.from(this.selection)));
            // looks weird but passing data as an argument to the function would be kinda wrong too
            this.svg.selectAll(".dot").data(this.svg.selectAll(".dot").data() as Country[])
                .style("opacity", country => {
                    if(this.selection.has(country) || this.selection.size === 0) {
                        // Item is selected or there is not selection
                        return 1;
                    } else {
                        return this.unselectedOpacity;
                    }
                });
        });
    }

    private updateDots(selection: d3.Selection<SVGCircleElement | BaseType, Country, SVGGElement, {}>) {
        selection
            .transition()
            .duration(1000)
            .ease(easeLinear)
                .attr("cx", this.xMap)
                .attr("cy", this.yMap)
    }
}
