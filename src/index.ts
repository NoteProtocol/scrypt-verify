import type { Artifact, SupportedParamType, TxContext } from 'scryptlib';
import { buildContractClass, getValidatedHexString } from 'scryptlib';

export function buildOfflineContractInstance(abiJson: Artifact, dataMap: any) {
  const constructor = 'constructor';
  const paramsMap: Record<string, SupportedParamType[]> = {
    constructor: [],
  };

  const N20 = buildContractClass(abiJson);
  for (const abi of N20.abi) {
    let params: SupportedParamType[] = [];
    let data;

    if (abi.type === 'constructor') {
      params = paramsMap[constructor] = paramsMap[constructor] ?? [];
      data = dataMap[constructor];
    } else if (abi.type === 'function') {
      params = paramsMap[abi.name!] = paramsMap[abi.name!] ?? [];
      data = dataMap[abi.name!];
    }
    if (data) {
      for (const param of abi.params) {
        if (data[param.name] !== undefined) {
          if (param.type === 'int') {
            if (typeof data[param.name] === 'number' || typeof data[param.name] === 'bigint') {
              params.push(BigInt(data[param.name]));
            } else {
              //a buffer
              // params.push(byteString2Int(data[param.name].toString("hex")));
            }
          } else if (param.type === 'bytes') {
            params.push(getValidatedHexString(data[param.name]));
          } else {
            const r = parseAbiType(param.type);
            if (r.length > 0 && Array.isArray(data[param.name])) {
              params.push(data[param.name].slice(0, r.length));
            } else {
              params.push(data[param.name]);
            }
          }
        } else {
          if (param.type === 'int') {
            params.push(0n);
          } else if (param.type === 'bool') {
            params.push(false);
          } else {
            params.push('');
          }
        }
      }
    }
  }

  const instance = new N20(...paramsMap[constructor]!);
  return { N20, instance, paramsMap };
}

export function offlineVerify(abiJson: Artifact, dataMap: object, method: string, txContext?: TxContext) {
  const { N20, instance, paramsMap } = buildOfflineContractInstance(abiJson, dataMap);
  if (!paramsMap[method]) {
    throw new Error(`method function is not exist in data`);
  }
  const unlocking = N20.abiCoder.encodePubFunctionCall(instance, method, paramsMap[method]!);
  const result = instance.run_verify(unlocking.unlockingScript);
  return result;
}

function parseAbiType(abiType: string): { type: string; length: number } {
  const match = abiType.match(/([a-zA-Z]+)\[(\d+)\]/);

  if (match) {
    const [, type, length] = match;
    return { type, length: parseInt(length, 10) };
  } else {
    return { type: abiType, length: 0 };
  }
}
