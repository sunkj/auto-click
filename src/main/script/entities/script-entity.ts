import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'
import { StepEntity } from './step-entity'

@Entity('scripts')
export class ScriptEntity {
  @PrimaryColumn('text')
  id!: string

  @Column('text', { default: 'script' })
  type!: string

  @Column('text', { name: 'parent_id', nullable: true })
  @Index('IDX_scripts_parent_id')
  parentId!: string | null

  @Column('text')
  name!: string

  @Column('text', { name: 'file_path', nullable: true, unique: true })
  filePath!: string | null

  @Column('text', { nullable: true })
  description!: string | null

  @Column('simple-json', { name: 'initial_context', nullable: true })
  initialContext!: Record<string, string> | null

  @Column('integer', { name: 'sort_order', default: 0 })
  sortOrder!: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @OneToMany(() => StepEntity, (step) => step.script, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  steps!: StepEntity[]
}
