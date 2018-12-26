import { DSVRowString, dsvFormat } from "d3-dsv";
import { text, json } from "d3-fetch";
import { ok } from "assert";

export enum years {
    Y2010 = '2010',
    Y2011 = '2011',
    Y2012 = '2012',
    Y2013 = '2013',
    Y2014 = '2014',
    Y2015 = '2015',
    Y2016 = '2016',
    Y2017 = '2017'
};

export interface Country {
    code: string;
    name: string;
    region: string;
    stats: Map<string, CountryStats>
}

export class DataSource {
     /**
      * Used to match names that differ from the official style in the countries.json
      *  */
     private static forcedCountryNames = new Map([
        ["BRN", ["Brunei Darussalam"]],
        ["PSE", ["Palestine, State of"]],
        ["STP", ["Sao Tome and Principe"]],
        ["MKD", ["The former Yugoslav Republic of Macedonia"]],
        ["HKG", ["Hong Kong, China (SAR)"]],
        // This mapping is the wrong way round in the dataset
        ["COG", ["Congo (Democratic Republic of the)"]],
        ["COD", ["Congo"]]
    ]);

    private data = new Map<string, Country>();

    private constructor() {
    }

    /**
     * Asynchronously loads and maps the .csv data sources
     */
    public static async loadData(): Promise<DataSource> {
        const dataSrcLoaders = Promise.all([
            DataSource.csvLoader("gdp", "data/gdp.csv"),
            DataSource.csvLoader("ineq_comb","data/inequality.csv"),
            DataSource.csvLoader("ineq_edu", "data/inequality_education.csv"),
            DataSource.csvLoader("ineq_inc", "data/inequality_income.csv"),
            DataSource.csvLoader("ineq_life","data/inequality_life_expectancy.csv")
        ]);

        const data = new Map(await dataSrcLoaders);
        const countries = await DataSource.readCountryInfoDB();

        const dataSource = new DataSource();
        dataSource.data = new Map<string, Country>();
        for (let countryCSVName of data.get("gdp").keys()) {
            countryCSVName = countryCSVName.trim();

            const code = countries.nameToCode.get(countryCSVName)
            const countryInfo = countries.infoFromCode.get(code);
            ok(countryInfo, `No country info for ${countryCSVName}`);
            // Merge the country info and the statistics and add them to the database
            dataSource.data.set(
                countryInfo.name,
                Object.assign(countryInfo, {stats: DataSource.readCountryStats(data, countryCSVName)}));
        }

        return dataSource;
    }

    public getCountry(name: string) : Country {
        return this.data.get(name);
    }


    private static async csvLoader(resourceID: string, source: string): Promise<[string, Map<string, DSVRowString>]> {
        const countryMappedData = new Map(
            csv_semicolon(await text(source)).map<[string,DSVRowString]>(row =>
                [row.Country.trim(), row]));
        return [resourceID,countryMappedData];
    }

    private static readCountryStats(data: Map<string, Map<String, DSVRowString>>, countryName: string): Map<string, CountryStats> {
        const countryStats = new Map<string, CountryStats>();
        const safeFetchData = (resourceID: string, year: string) => {
            let row = data.get(resourceID).get(countryName);
            if(row === undefined){
                return null;
            } else {
                return row[year];
            }
        }

        for (const year in years) {
            countryStats.set(year,
                {
                    gdp: parseInt(safeFetchData("gdp", year)),
                    inequality: {
                        combined: parseFloat(safeFetchData("ineq_comb",year)),
                        education: parseFloat(safeFetchData("ineq_edu",year)),
                        life_expectancy: parseFloat(safeFetchData("ineq_inc",year)),
                        income: parseFloat(safeFetchData("ineq_life",year))
                    }
                })
        }

        return countryStats;
    }

    private static async readCountryInfoDB(): Promise<CountryInfoDatabase> {
        const nameDB = new Map<string, string>();
        const srcJson = await json("data/countries-unescaped.json") as any[];

        for (const country of srcJson) {
            const alternateNames: string[] = [country.name.common, country.name.official];

            // Add names from native languages
            for (const lang in country.name.native as {}) {
                let language = country.name.native[lang];
                alternateNames.push(language.common);
                alternateNames.push(language.official);
            }

            // Add variations for patterns like Republic of xyz => xyz (Republic of)
            const orderVariations: string[] = [];
            alternateNames.forEach(country => {
                const marker = " of "
                const ofPos = country.indexOf(marker);
                if(ofPos !== -1) {
                    const prefix = country.substring(0, ofPos + marker.length).trim();
                    const countryName = country.substring(ofPos + marker.length).trim();
                    orderVariations.push(`${countryName} (${prefix})`);
                }
            })
            orderVariations.forEach(variant => alternateNames.push(variant));

            // Add alternative spellings
            country.altSpellings.forEach((spelling: string) => alternateNames.push(spelling))

            // Add names that are different in the csv sources
            const forcedNames = DataSource.forcedCountryNames.get(country.cca3);
            if(forcedNames !== undefined) {
                for (const forcedMatch of forcedNames) {
                    alternateNames.push(forcedMatch);
                }
            }


            alternateNames.forEach(name => nameDB.set(name, country.cca3));
        }

        const info = new Map(
            srcJson.map<[string, {code: string, name: string, region: string}]>(country =>
                [country.cca3, {code: country.cca3, name: country.name.common, region: country.region}]));

        return {
            nameToCode: nameDB,
            infoFromCode: info
        };
    }
}

const csv_semicolon = dsvFormat(';').parse;

interface CountryInfoDatabase {
    nameToCode: Map<string, string>,
    infoFromCode: Map<string, {code: string, name: string, region: string}>
}

interface CountryStats {
    gdp: number,
    inequality: {
        combined: number,
        education: number,
        life_expectancy: number,
        income: number
    }
}
