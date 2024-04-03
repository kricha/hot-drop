import { lightFormat } from "date-fns";
import { appendFileSync } from 'fs'


export const randomString=(len, charSet) =>{
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
      var randomPoz = Math.floor(Math.random() * charSet.length);
      randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
  }
  
  export const  randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

  export const logEntry = (entry, logger='main') => {
    const entryWithDate = `${lightFormat(new Date(), 'yyyy-MM-dd HH:mm')} ${entry}`
    console.log(`[${logger}] ${entryWithDate}`)
    appendFileSync(`${logger}.log`, `${entryWithDate}\r\n`);
  }