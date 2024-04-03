import nearAPI, { Contract } from 'near-api-js';
import { readFileSync } from 'fs';
import { differenceInMilliseconds, formatDistanceToNow, lightFormat } from "date-fns";
import nodeCache from "node-cache"
import { logEntry, randomIntFromInterval } from './utils.js';

const cache = new nodeCache({ stdTTL: 3600 * 4 })

const VAULT_LEVELS = [
  {
    level: 1,
    moon_required_to_level_up: 25000000,
    vault_storage_capacity_in_nanoseconds: 7200000000000
  },
  {
    level: 2,
    moon_required_to_level_up: 38000000,
    vault_storage_capacity_in_nanoseconds: 14400000000000
  },
  {
    level: 3,
    moon_required_to_level_up: 56000000,
    vault_storage_capacity_in_nanoseconds: 21600000000000
  },
  {
    level: 4,
    moon_required_to_level_up: 84000000,
    vault_storage_capacity_in_nanoseconds: 28800000000000
  },
  {
    level: 5,
    moon_required_to_level_up: 127000000,
    vault_storage_capacity_in_nanoseconds: 36000000000000
  },
  {
    level: 6,
    moon_required_to_level_up: 380000000,
    vault_storage_capacity_in_nanoseconds: 43200000000000
  },
  {
    level: 7,
    moon_required_to_level_up: 570000000,
    vault_storage_capacity_in_nanoseconds: 57600000000000
  },
  {
    level: 8,
    moon_required_to_level_up: 854000000,
    vault_storage_capacity_in_nanoseconds: 72000000000000
  },
  {
    level: 9,
    moon_required_to_level_up: 999000000000,
    vault_storage_capacity_in_nanoseconds: 86400000000000
  },
  {
    level: 10,
    moon_required_to_level_up: 999000000000,
    vault_storage_capacity_in_nanoseconds: 172800000000000
  }
]





const { keyStores, KeyPair } = nearAPI;

const myKeyStore = new keyStores.InMemoryKeyStore();

const creds = JSON.parse(await readFileSync('./moon.json'));
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

const checkAndHarvestIfNeed = async (accountId) => {
  const account = await near.account(accountId);
  const contract = new Contract(
    account,
    "harvest-moon.near",
    {
      viewMethods: ["view_account_info", "get_vault_levels", "get_vault_storage_capacity_in_nanoseconds", "ft_balance_of"],
      changeMethods: ["harvest"],
    }
  );

  /**
   {
    last_harvested_at: 1711891132703754000,
    referrer_id: 'whitecat1501.near',
    space_tinkers: { '1': 5, '2': 6, '3': 4 },
    deployed_space_tinkers: [
      3, 3, 3, 3, 2,
      2, 2, 2, 2, 2
    ],
    space_tinkers_production_per_hour: '5400000',
    vault_level: 1,
    lab_level: 1,
    gear_level: 1,
    tinker_staked: [],
    guild_id: null,
    staked_relics: []
  }
  let res = await contract.view_account_info({account_id: accountId});
   */
  let {vault_level, last_harvested_at} = await contract.view_account_info({account_id: accountId});
  const currentLevelCapacityInMs = VAULT_LEVELS.filter((el)=> el.level===vault_level).map((el)=>el.vault_storage_capacity_in_nanoseconds)/10e5
  const currentFillFactorTmp = differenceInMilliseconds(new Date(), last_harvested_at/1e6)/currentLevelCapacityInMs
  const currentFillPercentFactor = currentFillFactorTmp > 1 ? 1 : currentFillFactorTmp;
  const currentFillPercent = Number((currentFillFactorTmp*100).toFixed(2))
  const moonBalanceBefore = Number(await contract.ft_balance_of({account_id: accountId}))
  const moonBalanceBeforeHuman = (moonBalanceBefore/1e8).toFixed(4)
  const nearBalanceBefore = ((await account.getAccountBalance()).available / 10e23).toFixed(5)

  const neededPercent = randomIntFromInterval(85, 99)
  const needToClaim = neededPercent < currentFillPercent || currentFillPercent >= 99;
  if (needToClaim) {
    account.signAndSendTransaction({
      receiverId: 'harvest-moon.near',
      sign
    })
    return;
    log1(`Need to harvest account ${accountId}, ${nearBalanceBefore} NEAR, ${moonBalanceBeforeHuman} MOON`)
    contract.harvest({ args: {  } }).then(async (haRes) => {
      console.log({haRes})
      const moonBalanceAfter = Number(await contract.ft_balance_of({account_id: accountId}))
      const moonBalanceAfterHuman = (moonBalanceAfter/1e8).toFixed(4)
      const nearBalanceAfter = ((await account.getAccountBalance()).available / 10e23).toFixed(5)
      log1(`Harvest ${accountId} OK! ${nearBalanceAfter} NEAR, ${moonBalanceAfterHuman} MOON`)

    })
  }
  
  // console.log(currentFillPercentFactor, {moonBalanceBefore})
  // const lastClaimDate = new Date(userInfo.last_claim / 1e6);
  // const dateDiff = differenceInMilliseconds(new Date(), lastClaimDate)
  // const userMaxMineMiliseconds = ASSET_STORAGES.filter((asset) => asset.id === userInfo.storage).map((asset) => asset.value) / 1e6;
  // const userMineBoost = ASSET_BOOSTS.filter((asset) => asset.id === userInfo.boost).map((asset) => asset.value) * 1;
  // const userMineSpeed = ASSET_FIRESPACE.filter((asset) => asset.id === userInfo.firespace).map((asset) => asset.value) * 1;
  // const milisecondInHour = 60 * 60 * 1000;
  // const miningSpeedPerHour = userMineSpeed * userMineBoost;
  // const miningSpeedPerMilisecond = miningSpeedPerHour / milisecondInHour;
  // const FullHotStorageValue = miningSpeedPerMilisecond * userMaxMineMiliseconds
  // const FullHotStorageValueHuman = FullHotStorageValue / 1e7;
  // const miningSpeedPerHourHuman = userMineSpeed * userMineBoost / 1e7;
  // const storageFilledOn = dateDiff / userMaxMineMiliseconds
  // const storageFilledOnPercent = (dateDiff / userMaxMineMiliseconds * 100).toFixed(2)
  // const currentStorageValue = Math.ceil(FullHotStorageValue * storageFilledOn)
  // const currentStorageValueHuman = (currentStorageValue / 1e7).toFixed(6)
  // const csrfCacheKey = `${accountId}-csrf`;
  // let csrf = cache.get(csrfCacheKey)
  // if (!csrf) {
  //   csrf = randomString(44)
  //   cache.set(csrfCacheKey, csrf)

  // }

  // const neededPercent = randomIntFromInterval(85, 99)
  // const needToClaim = neededPercent < Number(storageFilledOnPercent) || storageFilledOnPercent >= 99;
  // const nearBalance = ((await account.getAccountBalance()).available / 10e23).toFixed(5)
  // if (needToClaim) {
  //   setTimeout(() => {
  //     contract.claim({ args: { csrf } }).then(async () => {
  //       logEntry(`[${accountId}] [${nearBalance}Ⓝ] claim ${storageFilledOnPercent}% of storage (${FullHotStorageValueHuman}/${currentStorageValueHuman}) filled in ${formatDistanceToNow(lastClaimDate)} (${miningSpeedPerHourHuman} HOT/hour)`);
  //       if (creds[accountId].upgradeble) {
  //         userInfo = (await contract.get_users({ account_ids: [accountId] }))[0]
  //         const needStorgeUpgrade = ASSET_STORAGES.filter(el => el.id > userInfo.storage && el.hot_price <= userInfo.balance)[0]
  //         if (needStorgeUpgrade) {
  //           await contract.buy_asset({ args: { 'asset_id': needStorgeUpgrade.id } });
  //           logEntry(`[${accountId}] storage upgraded to ${needStorgeUpgrade.id} for ${needStorgeUpgrade.hot_price / 10e6} HOT`);
  //           userInfo = (await contract.get_users({ account_ids: [accountId] }))[0]
  //         }

  //         const needFirespaceUpgrade = ASSET_FIRESPACE.filter(el => el.id > userInfo.firespace && el.hot_price <= userInfo.balance)[0]
  //         if (needFirespaceUpgrade) {
  //           await contract.buy_asset({ args: { 'asset_id': needFirespaceUpgrade.id } });
  //           logEntry(`[${accountId}] speed upgraded to ${needFirespaceUpgrade.id} for ${needFirespaceUpgrade.hot_price / 10e6} HOT`);
  //         }
  //       }
  //     }).catch(error => {
  //       console.log(`[${accountId}] [${nearBalance}Ⓝ] claim error: ${error.message}`)
  //     })
  //   }, randomIntFromInterval(1 - 9) * 60000)
  // }
}

const log1 = (entry) => logEntry(entry, 'moon');

(await myKeyStore.getAccounts('mainnet')).forEach(async (accountId) => {
  if (creds[accountId].enabled) {
    // setInterval(() => {
      checkAndHarvestIfNeed(accountId)
    // }, 60 * 10 * 1000)
  }
});


