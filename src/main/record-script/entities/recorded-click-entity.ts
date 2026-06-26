import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('recorded_clicks')
export class RecordedClickEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column('text')
  name!: string

  @Column('integer')
  x!: number

  @Column('integer')
  y!: number

  @Column('text', { default: 'click' })
  type!: string

  @Column('text', { nullable: true })
  ext!: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
