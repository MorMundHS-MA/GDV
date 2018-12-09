import { DSVRowString, DSVParsedArray } from "d3";

export function joinDataSets(gdpRaw: DSVParsedArray<DSVRowString>, giniRaw: DSVParsedArray<DSVRowString>):DataTuple[] {
    console.log(gdpRaw);
    const gdpMap = new Map(
        gdpRaw.map<[String, number]>(row => 
            [row.Country, Number.parseInt(row['2017'])]));
    // TODO: Assert matching countries in dataset
    return giniRaw.map<DataTuple>(row => 
        ({
            country: row.Country,
            gdp: gdpMap.get(row.Country),
            gini: Number.parseFloat(row['2017'])
        }));
}

export interface DataTuple {
    country: String;
    gdp: number;
    gini: number;
}
