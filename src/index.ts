#!/usr/bin/env node
import * as fs from 'fs'
import * as util from 'util'
import { exec } from 'child_process'
import * as gpio from 'pigpio'

const configFile = process.argv[2]
const CONFIG = require(configFile)


const fanPin = new gpio.Gpio(18, {mode: gpio.Gpio.OUTPUT});

// util
const readFile = util.promisify(fs.readFile)
async function wait (millisec: number) {
  await new Promise(resolve => {
    setTimeout(resolve, millisec)
  })
}


// tem
const TEM_MAX = CONFIG.TEM_MAX || 60
const TEM_MIN = CONFIG.TEM_MIN || 45

async function readTem(): Promise<number> {
  const TEM_FILE = '/sys/class/thermal/thermal_zone0/temp'
  const str = (await readFile(TEM_FILE)).toString()
  return parseInt(str, 10) / 1000
}

// fan
async function fanInit (): Promise<void> {
  return new Promise((resolve, reject) => {
    resolve()
    // exec(`${GPIO_CMD} mode ${WIRE_PI_PIN} output`, (error) => {
    //   if (error) {
    //     reject(error)
    //   } else {
    //     resolve()
    //   }
    // })
  })
}

async function fanSwitch (isOn: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    fanPin.digitalWrite(isOn ? 1 : 0)
    resolve()
    // exec(`${GPIO_CMD} write ${WIRE_PI_PIN} ${isOn ? 1 : 0}`, (error) => {
    //   if (error) {
    //     reject(error)
    //   } else {
    //     resolve()
    //   }
    // })
  })
}

async function fanRelease (): Promise<void> {
  return new Promise((resolve, reject) => {
    resolve()
    // exec(`${GPIO_CMD} mode ${WIRE_PI_PIN} input`, (error) => {
    //   if (error) {
    //     reject(error)
    //   } else {
    //     resolve()
    //   }
    // })
  })
}

// business
const SAMPLE_MAX = CONFIG.SAMPLE_MAX || 3
const SAMPLE_PERIOD = CONFIG.SAMPLE_PERIOD || 5000
let targetTem: number | null = null
const temSamples: number[] = []

async function main() {
  await fanInit()
  while (true) {
    const tem = await readTem()
    temSamples.push(tem)
    while (temSamples.length > SAMPLE_MAX) {
      temSamples.shift()
    }
    const avg = temSamples.reduce((res, item) => {
      return res + item
    }, 0) / temSamples.length
    console.log(`tem samples: ${temSamples}`)
    console.log(`current tem(avg): ${avg}`)
    
    if (avg > TEM_MAX && targetTem === null) {
      targetTem = TEM_MIN
    }

    console.log(`targetTem: ${targetTem}`)
    if (targetTem !== null && avg > targetTem) {
      console.log('open fan')
      await fanSwitch(true)
    } else {
      console.log('close fan')
      await fanSwitch(false)
      targetTem = null
    }

    await wait(SAMPLE_PERIOD)
  }
}

async function onQuit () {
  await fanRelease()
  process.exit(1)
}

process.on('SIGINT', onQuit)
process.on('SIGTERM', onQuit)

main().catch(async e => {
  console.error(e)
  await onQuit()
})
