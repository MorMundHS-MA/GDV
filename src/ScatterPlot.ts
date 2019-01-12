import * as d3 from "d3";
import { Axis, BaseType, easeQuad, ScaleLinear, ScaleLogarithmic } from "d3";
import { DataSource, ICountry, years } from "./DataSource";

export class ScatterPlot {
    private readonly svg: d3.Selection<SVGGElement, {}, HTMLElement, any>;
    private readonly tooltip: d3.Selection<HTMLDivElement, {}, HTMLElement, any>;
    private readonly yearLabel: d3.Selection<SVGTextElement, {}, HTMLElement, any>;

    private data: DataSource;
    private selection = new Set<ICountry>();

    private readonly margin = { top: 20, right: 20, bottom: 30, left: 30 };
    private readonly width: number;
    private readonly height: number;

    private displayedYear = years[0];

    private readonly yScale: ScaleLogarithmic<number, number>;
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
        this.yScale = d3.scaleLog().range([this.height, 0]);
        this.yAxis = d3.axisLeft(this.yScale).tickFormat(d3.format("~s"));

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
                .text("Inequality");

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
                .text("GDP per Person in USD");

        const labelContainer = this.svg .append("g");
        this.yearLabel = labelContainer
            .append("text")
                .attr("class", "year label")
                .attr("x", this.width / 2)
                .text(this.displayedYear);

        this.animateScatterPlot();

        // draw legend
        const legend = this.svg.selectAll(".legend")
        .data(this.color.domain())
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => "translate(0," + i * 20 + ")")
        .on("click", (region) => {
            this.setSelection(this.data.getCountries().filter((country) => country.region === region));
        });

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
            this.displayedYear = year;
        }

        this.yearLabel.text(this.displayedYear);
        this.updateScatterPlot(this.data.getCountries());
    }

    public subscribeOnSelectionChanged(listener: (selection: ICountry[]) => void) {
        this.onSelectChange.push(listener);
    }

    public setSelectionByName(selection: string[]) {
        this.setSelection(selection.map((name) => this.data.getCountry(name)));
    }

    public setSelection(selection: ICountry[]) {
        this.selection = new Set(selection);
        this.updateOpacityForSelection();
    }

    public getDisplayedYear() {
        return this.displayedYear;
    }

    /*
    * value accessor - returns the value to encode for a given data object.
    * scale - maps value to a visual display encoding, such as a pixel position.
    * map function - maps from data value to display value
    * axis - sets up axis
    */
    // setup x
    private readonly xValue = (country: ICountry) => country.stats.get(this.displayedYear).inequality.combined;
    private readonly xMap = (country: ICountry) => this.xScale(this.xValue(country));

    // setup y
    private readonly yValue = (country: ICountry) => country.stats.get(this.displayedYear).gdp;
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
        .attr("r", 4.5)
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
                + ", " + d3.format(".3~s")(this.yValue(country)) + " USD)")
                .style("left", (this.xMap(country) + 55) + "px")
                .style("top", this.yMap(country) + "px");
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

            this.updateOpacityForSelection();
        });
    }

    private updateDots(selection: d3.Selection<SVGCircleElement | BaseType, ICountry, SVGGElement, {}>) {
        selection
            .transition()
            .duration(1000)
            .ease(easeQuad)
                .attr("cx", this.xMap)
                .attr("cy", this.yMap);
    }

    private updateOpacityForSelection() {
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
    }
}
