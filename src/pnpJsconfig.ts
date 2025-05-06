import { spfi, SPFx } from '@pnp/sp';
import { WebPartContext } from '@microsoft/sp-webpart-base';

let sp: ReturnType<typeof spfi>;

export const setupSP = (context: WebPartContext): void => {
  sp = spfi().using(SPFx(context));
};

export { sp };