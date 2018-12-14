import * as d3 from "d3";
import { DataTuple, joinDataSets, years } from "./parseHelper";
import { BaseType } from "d3";
var margin = { top: 20, right: 20, bottom: 30, left: 40 },
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

const scsv = d3.dsvFormat(';');

let currentYear = years[0];

/*
 * value accessor - returns the value to encode for a given data object.
 * scale - maps value to a visual display encoding, such as a pixel position.
 * map function - maps from data value to display value
 * axis - sets up axis
 */

// setup x
const xValue = (d: DataTuple) => d.gini;
const xScale = d3.scaleLinear().range([0, width]);
const xMap = (d: DataTuple) => xScale(xValue(d));
const xAxis = d3.axisBottom(xScale);

// setup y
const yValue = (d: DataTuple) => d.gdp;
const yScale = d3.scaleLinear().range([height, 0]);
const yMap = (d: DataTuple) => yScale(yValue(d));
const yAxis = d3.axisLeft(yScale);

// setup fill color
const cValue = (d: DataTuple) => 'Europe';
const color = d3.scaleOrdinal(d3.schemeCategory10);

// add the graph canvas to the body of the webpage
const svg = d3.select("#root").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// add the tooltip area to the webpage
const tooltip = d3.select("#root").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

init();
async function init () {
    const data = joinDataSets(
        scsv.parse(await d3.text("data/gdp.csv")),
        scsv.parse(await d3.text("data/gini.csv")));

    let xMax = Number.NEGATIVE_INFINITY, xMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY, yMin = Number.POSITIVE_INFINITY;
    data.forEach(year => year.forEach(country => {
        if(!Number.isFinite(xValue(country)) || !Number.isFinite(yValue(country)))
            return;
            
        xMax = Math.max(xMax, xValue(country));
        xMin = Math.min(xMin, xValue(country));
        yMax = Math.max(yMax, yValue(country));
        yMin = Math.min(yMin, yValue(country));
    }));

    // don't want dots overlapping axis, so add in buffer to data domain
    xScale.domain([xMin * 0.9, xMax * 1.1]);
    yScale.domain([yMin * 0.9, yMax * 1.1]);

    // x-axis
    svg
        .append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .append("text")
        .attr("class", "label")
        .attr("x", width)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text("Calories");

    // y-axis
    svg
        .append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Protein (g)");

    animateScatterPlot(data);
    setInterval(() => animateScatterPlot(data), 1000);

    // draw legend
    var legend = svg.selectAll(".legend")
        .data(color.domain())
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", function (d, i) { return "translate(0," + i * 20 + ")"; });

    // draw legend colored rectangles
    legend.append("rect")
        .attr("x", width - 18)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", color);

    // draw legend text
    legend.append("text")
        .attr("x", width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(function (d: any) { return d; });
    return data;
}

async function animateScatterPlot(data: Map<String, DataTuple[]>) {
    updateScatterPlot(data.get(currentYear));
    console.log('Updating graph for ' + currentYear)

    let nextIndex = (years.indexOf(currentYear) + 1) % years.length;
    currentYear = years[nextIndex];
}

function updateScatterPlot(data: DataTuple[]) {
    const graph = svg.selectAll(".dot")
        .data(data);
    // Update 
    updateDots(graph);

    //Enter
    updateDots(graph.enter().append('circle'), true);
   
    graph.exit().remove();
}

function updateDots(selection: d3.Selection<SVGCircleElement | BaseType, DataTuple, SVGGElement, {}>, isNew = false) {
    selection
        .attr("cx", xMap)
        .attr("cy", yMap)
    if(isNew) {
        selection
            .attr("class", "dot")
            .attr("r", 3.5)
            .style("fill", d => color(cValue(d)))
            .on("mouseover", d => {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(d.country + "<br/> (" + xValue(d)
                    + ", " + yValue(d) + ")")
                    .style("left", (d3.event.pageX + 5) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
    }
}