/** 错误码枚举 */
export enum ErrorCode {
  SCRIPT_NOT_FOUND = 'E001',
  SCRIPT_FORMAT_ERROR = 'E002',
  STEP_TYPE_INVALID = 'E003',
  COORD_OUT_OF_RANGE = 'E004',
  DEVICE_NOT_CONNECTED = 'E005',
  ADB_COMMAND_FAILED = 'E006',
  STEP_TIMEOUT = 'E007',
  EXECUTION_STOPPED = 'E008',
}

/** 引擎错误类 */
export class ScriptEngineError extends Error {
  code: ErrorCode
  stepIndex?: number

  constructor(code: ErrorCode, message: string, stepIndex?: number) {
    super(message)
    this.code = code
    this.stepIndex = stepIndex
    this.name = 'ScriptEngineError'
  }
}
