import { v4 as uuidv4 } from 'uuid'
import type { EngineStep, ExecutionContext as IExecutionContext } from './types'

/** 执行上下文工厂 */
export function createExecutionContext(
  scriptId: string,
  serial: string,
  steps: EngineStep[],
  stepInterval: number,
): IExecutionContext {
  return {
    executionId: uuidv4(),
    scriptId,
    serial,
    steps,
    stepInterval,
    currentIndex: 0,
    startTime: Date.now(),
  }
}
