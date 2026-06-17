export interface BaseResult {
  globeETR: number;
  qdmttAccrual: number;
  trueUpAmount: number;
  currency: string;
}

export interface ScenarioParameters {
  adjustedRate: number;
  qdmttElection: boolean;
  trueUpOffset: number;
}

export interface ScenarioDiff {
  globeETR: number;
  qdmttAccrual: number;
  trueUpAmount: number;
}

export interface ScenarioResult extends BaseResult {
  diff: ScenarioDiff;
}

/**
 * Deterministic, instant computation — never writes to the Record.
 */
export function computeScenario(base: BaseResult, params: ScenarioParameters): ScenarioResult {
  const globeETR = params.adjustedRate;
  const qdmttAccrual = params.qdmttElection ? 0 : base.qdmttAccrual;
  const trueUpAmount = base.trueUpAmount + params.trueUpOffset;

  return {
    globeETR,
    qdmttAccrual,
    trueUpAmount,
    currency: base.currency,
    diff: {
      globeETR: globeETR - base.globeETR,
      qdmttAccrual: qdmttAccrual - base.qdmttAccrual,
      trueUpAmount: trueUpAmount - base.trueUpAmount,
    },
  };
}
