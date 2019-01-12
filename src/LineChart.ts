import { easeLinear, line, Line } from "d3";
import { Axis, axisBottom, axisLeft, axisRight } from "d3-axis";
import { scaleLinear, ScaleLinear } from "d3-scale";
import { ICountry, StatLimits, StatValue, years } from "./DataSource";

interface IYearStats {year: string; value: number; }

type CountryStats = Map<ICountry, Map<StatValue, Array<{year: string, value: number}>>>;
export class LineChart {
    private readonly svg: d3.Selection<SVGGElement, {}, HTMLElement, any>;

    private readonly margin = { top: 20, right: 50, bottom: 30, left: 40 };
    private readonly width: number;
    private readonly height: number;

    private data: CountryStats = new Map();

    private readonly ineqScale: ScaleLinear<number, number>;
    private readonly ineqAxis: Axis<{valueOf(): number; }>;
    private readonly gdpScale: ScaleLinear<number, number>;
    private readonly gdpAxis: Axis<{valueOf(): number; }>;
    private readonly timeScale: ScaleLinear<number, number>;
    private readonly timeAxis: Axis<{valueOf(): number; }>;

    private gdpAxisElement: d3.Selection<SVGGElement, {}, HTMLElement, any>;
    private ineqAxisElement: d3.Selection<SVGGElement, {}, HTMLElement, any>;

    constructor(
        container: d3.Selection<d3.BaseType, {}, HTMLElement, any>,
        selectedCountries: CountryStats) {
        let heightAttr = container.attr("data-chart-height");
        let widthAttr = container.attr("data-chart-width");
        if (heightAttr === null || widthAttr === null) {
            heightAttr = "500";
            widthAttr = "960";
        }

        this.width = Number.parseInt(widthAttr) - this.margin.left - this.margin.right;
        this.height = Number.parseInt(heightAttr) - this.margin.top - this.margin.bottom;

        this.ineqScale = scaleLinear().range([this.height, 0]);
        this.ineqAxis = axisLeft(this.ineqScale);
        this.gdpScale = scaleLinear().range([this.height, 0]);
        this.gdpAxis = axisRight(this.gdpScale);
        this.timeScale = scaleLinear().range([0, this.width]);
        this.timeAxis = axisBottom(this.timeScale);

         // add the graph canvas to the body of the webpage
        this.svg = container.append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.timeScale.domain([Number.parseInt(years[0]) - 1, Number.parseInt(years[years.length - 1]) + 1]);

         // Year axis
        this.svg
            .append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + this.height + ")")
            .call(this.timeAxis);

        // Inequality axis
        this.ineqAxisElement = this.svg
            .append("g")
            .attr("class", "y axis");

        // GDP axis
        this.gdpAxisElement = this.svg
            .append("g")
            .attr("class", "y axis")
            .attr("transform", "translate(" + this.width + ", 0)");

        // Label
        this.svg
            .append("text")
            .attr("class", "country-label");

        this.setCountries(selectedCountries);
    }

    public setCountries(countries: CountryStats) {
        // Get changes in data
        const newCountries = Array.from(countries.keys()).filter((country) => !this.data.has(country));
        const removedCountries = Array.from(this.data.keys()).filter((country) => !countries.has(country));

        // Delete lines of removed countries
        for (const country of removedCountries) {
            this.svg.selectAll("." + country.code).remove();
        }

        this.data = countries;
        this.reScaleDomain();

        // Update existing lines to match rescaled domain
        for (const country of this.data) {
            this.updateDottedLine(StatValue.gdp, country[0]);
            this.updateDottedLine(StatValue.ineqComb, country[0]);
        }

        // Add newly selected countries
        for (const country of newCountries) {
            this.createDottedLine(StatValue.gdp, country);
            this.createDottedLine(StatValue.ineqComb, country);
        }

        // Update label
        this.svg.select(".country-label").text(Array.from(this.data.keys()).map((country) => country.name).join(", "));
    }

    private reScaleDomain() {
        const limits = new StatLimits();

        for (const country of this.data) {
            limits.expandRangeMany(Array.from(country[0].stats.values()));
        }

        const ineqLimit = limits.getIneqLimitAggregated();

        // don't want dots overlapping axis, so add in buffer to data domain
        this.ineqScale.domain([ineqLimit.min * 0.9, ineqLimit.max * 1.1]);
        this.gdpScale.domain([limits.gdp.min * 0.9, limits.gdp.max * 1.1]);

        // Update the drawn axis
        this.gdpAxisElement.call(this.gdpAxis);
        this.ineqAxisElement.call(this.ineqAxis);
    }
    private updateDottedLine(statType: StatValue, country: ICountry) {
        this.svg.selectAll(`.dot.${statType}.${country.code}`)
            .data(this.data.get(country).get(statType))
            .transition()
            .duration(200)
                .ease(easeLinear)
                    .attr("cx", (stats) => this.timeScale(Number.parseInt(stats.year)))
                    .attr("cy", this.getStatMapper(statType));

        this.svg.select(`.line.${statType}.${country.code}`)
            .datum(this.data.get(country).get(statType))
            .transition()
                .attr("d", this.getLine(statType));
    }

    private createDottedLine(statType: StatValue, country: ICountry) {
        this.svg
            .append("path")
            .attr("class", `line ${statType} ${country.code}`)
            .datum(this.data.get(country).get(statType))
            .attr("d", this.getLine(statType));

        this.svg
            .selectAll(`.dot.${statType}.${country.code}`)
            .data(this.data.get(country).get(statType))
            .enter()
                .append("circle")
                .attr("class", `dot ${statType} ${country.code}`)
                .attr("cx", (stats) => this.timeScale(Number.parseInt(stats.year)))
                .attr("cy", this.getStatMapper(statType))
                .attr("r", 5)
            .exit()
                .remove();
    }

    private getLine(statType: StatValue): Line<IYearStats> {
        return line<IYearStats>()
            .x((stats) => this.timeScale(Number.parseInt(stats.year)))
            .y(this.getStatMapper(statType));
    }

    private getStatMapper(statType: StatValue): ((stats: IYearStats) => number) {
        switch (statType) {
            case StatValue.gdp:
                return (stats) => this.gdpScale(stats.value);
            case StatValue.ineqComb:
            case StatValue.IneqLife:
            case StatValue.ineqEdu:
            case StatValue.ineqInc:
            return (stats) => this.ineqScale(stats.value);
        }
    }
}
