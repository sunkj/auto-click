import 'reflect-metadata'
import { DataSource, DataSourceOptions } from 'typeorm'
import { app } from 'electron'
import path from 'path'
import { ScriptEntity } from './entities/script-entity'
import { StepEntity } from './entities/step-entity'
import { RecordedClickEntity } from '../record-script/entities/recorded-click-entity'

const isDev = !app.isPackaged

/**
 * 获取数据库文件路径
 * 生产环境：app.getPath('userData')/database.sqlite
 * 开发环境：项目根目录/dev-database.sqlite
 */
function getDatabasePath(): string {
  if (isDev) {
    return path.join(__dirname, '../../../../dev-database.sqlite')
  }
  return path.join(app.getPath('userData'), 'database.sqlite')
}

/**
 * 建表 DDL（与 Entity 定义保持一致）
 * 使用 IF NOT EXISTS 确保幂等
 */
const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "scripts" (
    "id" text PRIMARY KEY NOT NULL,
    "type" text NOT NULL DEFAULT 'script',
    "parent_id" text,
    "name" text NOT NULL,
    "file_path" text UNIQUE,
    "description" text,
    "initial_context" text,
    "sort_order" integer NOT NULL DEFAULT 0,
    "created_at" datetime NOT NULL DEFAULT (datetime('now')),
    "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_scripts_parent_id" ON "scripts" ("parent_id")`,
  `CREATE TABLE IF NOT EXISTS "steps" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "script_id" text NOT NULL,
    "step_index" integer NOT NULL,
    "type" text NOT NULL,
    "name" text,
    "data" text NOT NULL,
    "created_at" datetime NOT NULL DEFAULT (datetime('now')),
    "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY ("script_id") REFERENCES "scripts" ("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_script_step_index" ON "steps" ("script_id", "step_index")`,
  `CREATE INDEX IF NOT EXISTS "IDX_steps_script_id" ON "steps" ("script_id")`,
  `CREATE TABLE IF NOT EXISTS "recorded_clicks" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "name" text NOT NULL,
    "x" integer NOT NULL,
    "y" integer NOT NULL,
    "type" text NOT NULL DEFAULT 'click',
    "ext" text,
    "created_at" datetime NOT NULL DEFAULT (datetime('now')),
    "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
]

const dataSourceOptions: DataSourceOptions = {
  type: 'better-sqlite3',
  database: getDatabasePath(),
  synchronize: false,
  logging: ['error', 'warn'],
  entities: [ScriptEntity, StepEntity, RecordedClickEntity],
  migrations: [path.join(__dirname, 'migrations/**/*.{ts,js}')],
}

export const AppDataSource = new DataSource(dataSourceOptions)

let initialized = false

/**
 * 初始化数据库连接
 */
export async function initializeDatabase(): Promise<void> {
  if (initialized) {
    return
  }

  try {
    await AppDataSource.initialize()
    console.log('[Database] 数据库连接成功')

    const queryRunner = AppDataSource.createQueryRunner()
    try {
      for (const sql of CREATE_TABLES_SQL) {
        await queryRunner.query(sql)
      }

      // 迁移：为已有数据库添加 name 列（幂等执行）
      try {
        await queryRunner.query(`ALTER TABLE "steps" ADD COLUMN "name" text`)
        console.log('[Database] 迁移: steps.name 列已添加')
      } catch {
        // 列已存在则忽略
      }

      // 迁移：为已有数据库添加 initial_context 列（幂等执行）
      try {
        await queryRunner.query(`ALTER TABLE "scripts" ADD COLUMN "initial_context" text`)
        console.log('[Database] 迁移: scripts.initial_context 列已添加')
      } catch {
        // 列已存在则忽略
      }

      // 首次安装：写入示例数据
      const [{ count }] = await queryRunner.query(`SELECT COUNT(*) as count FROM "scripts"`)
      if (count === 0) {
        console.log('[Database] 首次安装，写入示例数据...')
        const folderId = '00000000-0000-0000-0000-000000000001'
        const scriptId = '00000000-0000-0000-0000-000000000002'
        // 创建"我的脚本"目录
        await queryRunner.query(
          `INSERT INTO "scripts" ("id", "type", "parent_id", "name", "file_path", "sort_order") VALUES (?, 'folder', NULL, '我的脚本', NULL, 1)`,
          [folderId]
        )
        // 创建示例脚本
        await queryRunner.query(
          `INSERT INTO "scripts" ("id", "type", "parent_id", "name", "file_path", "sort_order") VALUES (?, 'script', ?, '打开微信', 'scripts/打开微信', 2)`,
          [scriptId, folderId]
        )
        // 添加步骤：openApp 微信
        await queryRunner.query(
          `INSERT INTO "steps" ("script_id", "step_index", "type", "name", "data") VALUES (?, 1, 'openApp', '打开微信', '{"appName":"微信","description":"打开微信"}')`,
          [scriptId]
        )
        console.log('[Database] 示例数据写入完成')
      }

      console.log('[Database] 表结构已就绪')
    } finally {
      await queryRunner.release()
    }

    initialized = true
  } catch (error) {
    console.error('[Database] 数据库初始化失败:', error)
    throw error
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (initialized && AppDataSource.isInitialized) {
    await AppDataSource.destroy()
    initialized = false
    console.log('[Database] 数据库连接已关闭')
  }
}
