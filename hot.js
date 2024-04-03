import nearAPI, { Contract } from 'near-api-js';
import { readFileSync } from 'fs';
import { differenceInMilliseconds, formatDistanceToNow, lightFormat } from "date-fns";
import nodeCache from "node-cache"
import { appendFileSync } from 'fs'

const cache = new nodeCache({ stdTTL: 3600 * 4 })
const ASSET_STORAGES = [
  { hot_price: 0, id: 20, mission: '', value: 7200000000000 },
  { hot_price: 200000, id: 21, mission: '', value: 10800000000000 },
  { hot_price: 500000, id: 22, mission: '', value: 14400000000000 },
  { hot_price: 1000000, id: 23, mission: '', value: 21600000000000 },
  { hot_price: 4000000, id: 24, mission: '', value: 43200000000000 },
  { hot_price: 10000000, id: 25, mission: '', value: 86400000000000 }]
const ASSET_FIRESPACE = [
  { hot_price: 0, id: 0, mission: '', value: 5000 },
  { hot_price: 200000, id: 1, mission: '', value: 7500 },
  { hot_price: 1000000, id: 2, mission: '', value: 10000 },
  { hot_price: 2000000, id: 3, mission: '', value: 12500 },
  { hot_price: 5000000, id: 4, mission: '', value: 15000 },
  { hot_price: 15000000, id: 5, mission: '', value: 25000 }]
const ASSET_BOOSTS = [
  { hot_price: 0, id: 10, mission: '', value: 10 },
  { hot_price: 0, id: 11, mission: 'invite_friend', value: 12 },
  { hot_price: 0, id: 12, mission: 'download_app', value: 15 },
  { hot_price: 0, id: 13, mission: 'deposit_1NEAR', value: 18 },
  { hot_price: 0, id: 14, mission: 'deposit_1USDT', value: 20 },
  { hot_price: 0, id: 15, mission: 'deposit_NFT', value: 25 },
  { hot_price: 0, id: 99, mission: '', value: 1 }]

function randomString(len, charSet) {
  charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var randomString = '';
  for (var i = 0; i < len; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
}

function randomIntFromInterval(min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}


const { keyStores, KeyPair } = nearAPI;

const myKeyStore = new keyStores.InMemoryKeyStore();

const creds = JSON.parse(await readFileSync('./creds.json'));
for (const key in creds) {
  const keyPair = KeyPair.fromString(creds[key].pk);

  await myKeyStore.setKey('mainnet', key, keyPair);
}
const { connect } = nearAPI;

const connectionConfig = {
  networkId: 'mainnet',
  keyStore: myKeyStore, // first create a key store
  nodeUrl: 'https://rpc.mainnet.near.org',
  walletUrl: 'https://wallet.mainnet.near.org',
  helperUrl: 'https://helper.mainnet.near.org',
  explorerUrl: 'https://nearblocks.io',
};

const near = await connect(connectionConfig);

const checkAndClaimIfNeed = async (accountId) => {
  const account = await near.account(accountId);
  const contract = new Contract(
    account,
    "game.hot.tg",
    {
      viewMethods: ["get_users"],
      changeMethods: ["claim", "buy_asset"]
    }
  );

  let [userInfo] = await contract.get_users({ account_ids: [accountId] })
  const lastClaimDate = new Date(userInfo.last_claim / 1e6);
  const dateDiff = differenceInMilliseconds(new Date(), lastClaimDate)
  const userMaxMineMiliseconds = ASSET_STORAGES.filter((asset) => asset.id === userInfo.storage).map((asset) => asset.value) / 1e6;
  const userMineBoost = ASSET_BOOSTS.filter((asset) => asset.id === userInfo.boost).map((asset) => asset.value) * 1;
  const userMineSpeed = ASSET_FIRESPACE.filter((asset) => asset.id === userInfo.firespace).map((asset) => asset.value) * 1;
  const milisecondInHour = 60 * 60 * 1000;
  const miningSpeedPerHour = userMineSpeed * userMineBoost;
  const miningSpeedPerMilisecond = miningSpeedPerHour / milisecondInHour;
  const FullHotStorageValue = miningSpeedPerMilisecond * userMaxMineMiliseconds
  const FullHotStorageValueHuman = FullHotStorageValue / 1e7;
  const miningSpeedPerHourHuman = userMineSpeed * userMineBoost / 1e7;
  const storageFilledOn = dateDiff / userMaxMineMiliseconds
  const storageFilledOnPercent = (dateDiff / userMaxMineMiliseconds * 100).toFixed(2)
  const currentStorageValue = Math.ceil(FullHotStorageValue * storageFilledOn)
  const currentStorageValueHuman = (currentStorageValue / 1e7).toFixed(6)
  const csrfCacheKey = `${accountId}-csrf`;
  let csrf = cache.get(csrfCacheKey)
  if (!csrf) {
    csrf = randomString(44)
    cache.set(csrfCacheKey, csrf)

  }

  const neededPercent = randomIntFromInterval(85, 99)
  const needToClaim = neededPercent < Number(storageFilledOnPercent) || storageFilledOnPercent >= 99;
  const nearBalance = ((await account.getAccountBalance()).available / 10e23).toFixed(5)
  if (needToClaim) {
    setTimeout(() => {
      contract.claim({ args: { csrf } }).then(async () => {
        logEntry(`[${accountId}] [${nearBalance}Ⓝ] claim ${storageFilledOnPercent}% of storage (${FullHotStorageValueHuman}/${currentStorageValueHuman}) filled in ${formatDistanceToNow(lastClaimDate)} (${miningSpeedPerHourHuman} HOT/hour)`);
        if (creds[accountId].upgradeble) {
          userInfo = (await contract.get_users({ account_ids: [accountId] }))[0]
          const needStorgeUpgrade = ASSET_STORAGES.filter(el => el.id > userInfo.storage && el.hot_price <= userInfo.balance)[0]
          if (needStorgeUpgrade) {
            await contract.buy_asset({ args: { 'asset_id': needStorgeUpgrade.id } });
            logEntry(`[${accountId}] storage upgraded to ${needStorgeUpgrade.id} for ${needStorgeUpgrade.hot_price / 10e6} HOT`);
            userInfo = (await contract.get_users({ account_ids: [accountId] }))[0]
          }

          const needFirespaceUpgrade = ASSET_FIRESPACE.filter(el => el.id > userInfo.firespace && el.hot_price <= userInfo.balance)[0]
          if (needFirespaceUpgrade) {
            await contract.buy_asset({ args: { 'asset_id': needFirespaceUpgrade.id } });
            logEntry(`[${accountId}] speed upgraded to ${needFirespaceUpgrade.id} for ${needFirespaceUpgrade.hot_price / 10e6} HOT`);
          }
        }
      }).catch(error => {
        console.log(`[${accountId}] [${nearBalance}Ⓝ] claim error: ${error.message}`)
      })
    }, randomIntFromInterval(1 - 9) * 60000)
  }
}

(await myKeyStore.getAccounts('mainnet')).forEach(async (accountId) => {
  if (creds[accountId].enabled) {
    setInterval(() => {
      checkAndClaimIfNeed(accountId)
    }, 60 * 10 * 1000)
  }
});


const logEntry = (entry) => {
  const entryWithDate = `${lightFormat(new Date(), 'yyyy-MM-dd HH:mm')} ${entry}`
  console.log(entryWithDate)
  appendFileSync('main.log', `${entryWithDate}\r\n`);
}