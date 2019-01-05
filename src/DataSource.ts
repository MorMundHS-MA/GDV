import { ok } from "assert";
import { dsvFormat, DSVRowString } from "d3-dsv";
import { json, text } from "d3-fetch";

export const years = ["2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017"];

export interface ICountry {
    code: string;
    name: string;
    region: string;
    stats: Map<string, ICountryStats>;
}
export interface ICountryStats {
    gdp: number;
    inequality: {
        combined: number,
        education: number,
        life_expectancy: number,
        income: number,
    };
}

export class StatLimits {
    [key: string]: Limit;
    public gdp = new Limit();
    public ineqComb = new Limit();
    public ineqEdu = new Limit();
    public ineqInc = new Limit();
    public ineqLife = new Limit();
}

class Limit {
    public min: number = Number.POSITIVE_INFINITY;
    public max: number = Number.NEGATIVE_INFINITY;

    /**
     * Expands the number limit if the given number is outside of the current limit.
     * @param newNumber The number to test the limit for.
     */
    public expandRange(newNumber: number) {
        if (!Number.isFinite(newNumber)) {
            return;
        }
        this.min = Math.min(newNumber, this.min);
        this.max = Math.max(newNumber, this.max);
    }
}

export class DataSource {
    /**
     * Asynchronously loads and maps the .csv data sources
     */
    public static async loadData(): Promise<DataSource> {
        const dataSrcLoaders = Promise.all([
            DataSource.csvLoader("gdp", "data/gdp.csv"),
            DataSource.csvLoader("ineqComb", "data/inequality.csv"),
            DataSource.csvLoader("ineqEdu", "data/inequality_education.csv"),
            DataSource.csvLoader("ineqInc", "data/inequality_income.csv"),
            DataSource.csvLoader("ineqLife", "data/inequality_life_expectancy.csv"),
        ]);

        const countries = await DataSource.readCountryInfoDB();
        const data = new Map(await dataSrcLoaders);

        const dataSource = new DataSource();
        dataSource.data = new Map<string, ICountry>();
        for (let countryCSVName of data.get("gdp").keys()) {
            countryCSVName = countryCSVName.trim();

            const code = countries.nameToCode.get(countryCSVName);
            const countryInfo = countries.infoFromCode.get(code);
            ok(countryInfo, `No country info for ${countryCSVName}`);
            // Merge the country info and the statistics and add them to the database
            dataSource.data.set(
                countryInfo.name,
                Object.assign(
                    countryInfo,
                    {stats: DataSource.readCountryStats(data, countryCSVName, dataSource.dataLimits)}
                ));
        }

        return dataSource;
    }
     /**
      * Used to match names that differ from the official style in the countries.json
      */
     private static forcedCountryNames = new Map([
        ["BRN", ["Brunei Darussalam"]],
        ["PSE", ["Palestine, State of"]],
        ["STP", ["Sao Tome and Principe"]],
        ["MKD", ["The former Yugoslav Republic of Macedonia"]],
        ["HKG", ["Hong Kong, China (SAR)"]],
        // This mapping is the wrong way round in the dataset
        ["COG", ["Congo (Democratic Republic of the)"]],
        ["COD", ["Congo"]],
    ]);

    private static async csvLoader(resourceID: string, source: string): Promise<[string, Map<string, DSVRowString>]> {
        const countryMappedData = new Map(
            csvSemicolon(await text(source)).map<[string, DSVRowString]>((row) =>
                [row.Country.trim(), row]));
        return [resourceID, countryMappedData];
    }

    private static readCountryStats(
        data: Map<string, Map<string, DSVRowString>>, countryName: string, limits: StatLimits):
        Map<string, ICountryStats> {
        const countryStats = new Map<string, ICountryStats>();
        const safeFetchData = (resourceID: string, year: string) => {
            const row = data.get(resourceID).get(countryName);
            if (row === undefined) {
                return null;
            } else {
                limits[resourceID].expandRange(parseFloat(row[year]));
                return row[year];
            }
        };

        for (const year of years) {
            countryStats.set(year,
                {
                    gdp: parseInt(safeFetchData("gdp", year)),
                    inequality: {
                        combined: parseFloat(safeFetchData("ineqComb", year)),
                        education: parseFloat(safeFetchData("ineqEdu", year)),
                        income: parseFloat(safeFetchData("ineqLife", year)),
                        life_expectancy: parseFloat(safeFetchData("ineqInc", year))
                    },
                });
        }

        return countryStats;
    }

    private static async readCountryInfoDB(): Promise<ICountryInfoDatabase> {
        const nameDB = new Map<string, string>();
        const srcJson = await json("data/countries-unescaped.json") as any[];

        for (const country of srcJson) {
            const alternateNames: string[] = [country.name.common, country.name.official];

            // Add names from native languages
            for (const lang in country.name.native as {}) {
                if (country.name.native.hasOwnProperty(lang)) {
                    const language = country.name.native[lang];
                    alternateNames.push(language.common);
                    alternateNames.push(language.official);
                }
            }

            // Add variations for patterns like Republic of xyz => xyz (Republic of)
            const orderVariations: string[] = [];
            alternateNames.forEach((c) => {
                const marker = " of ";
                const ofPos = c.indexOf(marker);
                if (ofPos !== -1) {
                    const prefix = c.substring(0, ofPos + marker.length).trim();
                    const countryName = c.substring(ofPos + marker.length).trim();
                    orderVariations.push(`${countryName} (${prefix})`);
                }
            });
            orderVariations.forEach((variant) => alternateNames.push(variant));

            // Add alternative spellings
            country.altSpellings.forEach((spelling: string) => alternateNames.push(spelling));

            // Add names that are different in the csv sources
            const forcedNames = DataSource.forcedCountryNames.get(country.cca3);
            if (forcedNames !== undefined) {
                for (const forcedMatch of forcedNames) {
                    alternateNames.push(forcedMatch);
                }
            }

            alternateNames.forEach((name) => nameDB.set(name, country.cca3));
        }

        const info = new Map(
            srcJson.map<[string, {code: string, name: string, region: string}]>((country) =>
                [country.cca3, {code: country.cca3, name: country.name.common, region: country.region}]));

        return {
            infoFromCode: info,
            nameToCode: nameDB
        };
    }

    private data = new Map<string, ICountry>();
    private dataLimits: StatLimits = new StatLimits();

    private constructor() {
    }

    public getCountry(name: string): ICountry {
        return this.data.get(name);
    }

    public getCountries(): ICountry[] {
        return Array.from(this.data.values());
    }

    /**
     * Returns the value range for the statistics in the data set.
     */
    public getStatLimits(): StatLimits {
        return this.dataLimits;
    }
}

const csvSemicolon = dsvFormat(";").parse;

interface ICountryInfoDatabase {
    nameToCode: Map<string, string>;
    infoFromCode: Map<string, {code: string, name: string, region: string}>;
}
