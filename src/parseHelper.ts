import { DSVRowString, DSVParsedArray } from "d3";

export const years = ['2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017'];

export function joinDataSets(gdpRaw: DSVParsedArray<DSVRowString>, giniRaw: DSVParsedArray<DSVRowString>): Map<String, DataTuple[]> {
    const result = new Map();
    for (const year of years) {
        //Map gdp data to country => gdp
        const gdpMap = new Map(
            gdpRaw.map<[String, number]>(row => 
                [row.Country, Number.parseInt(row[year])]));

        // Map gini data and merge the datasets
        const mappedData = giniRaw.map<DataTuple>(row => {
                const countryData = {
                    country: row.Country,
                    gdp: gdpMap.get(row.Country),
                    gini: Number.parseFloat(row[year])
                };

                if(process.env.MODE !== 'production'  && (countryData.gdp === undefined || countryData === undefined)) {
                    console.warn(`Missing data in ${year} for ${countryData.country}.`);
                }

                return countryData;
            });

        result.set(year, mappedData);
    }

    return result;
}

export interface DataTuple {
    country: String;
    gdp: number;
    gini: number;
}
