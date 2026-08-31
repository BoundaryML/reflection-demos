import { loadBamlSdk } from "./bamlClient.js";
import type { InvokeResult } from "./baml_sdk/index.js";

export async function invokeFunction(
  name: string,
  args: Record<string, string>,
): Promise<InvokeResult> {
  const sdk = await loadBamlSdk();
  return sdk.InvokeFunction_async(name, args);
}
