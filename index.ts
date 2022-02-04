import axios from "axios";
import { JSDOM } from "jsdom";
import moment from "moment";
import _, { result } from 'lodash'
import PromisePool from "@supercharge/promise-pool";
import { Client, Pool } from "pg";
import dotenv from 'dotenv'
import { program } from "commander";

dotenv.config()

const conf = {
  user: process.env['PGUSER'],
  password: process.env['PGPASSWORD'],
  database: process.env['PGDATABASE'],
  port: parseInt(process.env['PGPORT'] ?? ""),
  host: process.env["PGHOST"]
}
const pool = new Pool(conf)


const base_query = {
  utf8: "✓",
};
const url = "https://browser.geekbench.com/search";

async function total_pages(q: string) {
  const res = await axios.get(url, {
    params: {
      ...base_query,
      q
    }
  });
  const dom = new JSDOM(res.data);
  const Pages = Array.from(dom.window.document.querySelectorAll(".page-item"))
    .map(e => (parseInt((e as HTMLElement).textContent ?? "")))
    .filter(e => !isNaN(e))
    .sort((a, b) => b - a)
  return Pages[0]
}
type Awaited<T> = T extends PromiseLike<infer U> ? U : T


type BenchResult = Awaited<ReturnType<typeof read_page>>[0]
async function read_page(q: string, page: number) {
  const res = await axios.get(url, {
    params: {
      ...base_query,
      q, page
    }
  });
  const dom = new JSDOM(res.data);
  const cards = Array.from(dom.window.document.querySelectorAll(".col-12 .list-col"))
  const results = cards.map(e => e as HTMLDivElement).map(a => {
    return ({
      id: a.querySelector(".row>:nth-child(1)>a")?.getAttribute("href")?.split('/').reverse()[0],
      cpu: a.querySelector(".row>:nth-child(1)>.list-col-model")?.textContent,
      system: a.querySelector(".row>:nth-child(1)>a")?.textContent,
      date: moment(a.querySelector(".timestamp-to-local-short")?.textContent).format('YYYY-MM-DD HH:mm:ss.SSSSSS'),
      platform: a.querySelector(".row>:nth-child(3)>.list-col-text")?.textContent,
      single_score: parseInt(a.querySelector(".row>:nth-child(4)>.list-col-text-score")?.textContent ?? ""),
      multi_score: parseInt(a.querySelector(".row>:nth-child(5)>.list-col-text-score")?.textContent ?? "")
    });

  })
  return results
}

async function save_results(res: BenchResult) {
  await pool.query({
    text: `
    INSERT INTO geekbench5_cpu 
      (id,cpu,sys,date,platform,single_score,multi_score)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id)
    DO NOTHING
      `,
    values: [
      res.id,
      res.cpu?.replace(/\n/g, " "),
      res.system?.replace(/\n/g, " "),
      res.date,
      res.platform?.replace(/\n/g, " "),
      res.single_score,
      res.multi_score
    ]
  })

}

async function handle_query(q: string) {
  const pages = await total_pages(q)
  let all = 0;
  const res = await PromisePool.withConcurrency(_.min([pages, 5]) ?? 1).for(_.range(pages))
    .process(async (p) => {
      all += 1
      let current = all
      console.log(`processing (${all}/${pages})`)
      const res = await read_page(q, p + 1)
      await Promise.all(res.map(save_results))
      console.log(`(${current}/${pages}) processed`)
    })
  console.log(333, res)
}

program
  .name("geekbench-helper")
  .description("utility help one to analyze geekbench result")
  .command('save')
  .description("save query to postgre database")
  .argument('<query>', "query to process")
  .action((query) => {
    handle_query(query)
  })


program.parse();



