import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm'
import { ScriptEntity } from './script-entity'

@Entity('steps')
@Unique('UQ_script_step_index', ['scriptId', 'stepIndex'])
export class StepEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column('text', { name: 'script_id' })
  @Index('IDX_steps_script_id')
  scriptId!: string

  @Column('integer', { name: 'step_index' })
  stepIndex!: number

  @Column('text')
  type!: string

  @Column('text', { nullable: true })
  name?: string

  @Column('text')
  data!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => ScriptEntity, (script) => script.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'script_id' })
  script!: ScriptEntity
}
