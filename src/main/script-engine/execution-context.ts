import { randomUUID } from 'crypto'
import type { EngineStep, ExecutionContext as IExecutionContext } from './types'

/** 执行上下文工厂 */
export function createExecutionContext(
  scriptId: string,
  serial: string,
  steps: EngineStep[],
  stepInterval: number,
  initialContext?: Record<string, string>,
): IExecutionContext {
  return {
    executionId: randomUUID(),
    scriptId,
    serial,
    steps,
    stepInterval,
    currentIndex: 0,
    startTime: Date.now(),
    context: { ...initialContext },
  }
}
