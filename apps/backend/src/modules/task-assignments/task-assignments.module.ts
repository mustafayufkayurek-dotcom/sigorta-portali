import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { TaskAssignmentsController } from './task-assignments.controller';
import { TaskAssignmentsService } from './task-assignments.service';
import { AssignmentRulesController } from './assignment-rules.controller';
import { AssignmentRulesService } from './assignment-rules.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaskAssignmentsController, AssignmentRulesController],
  providers: [TaskAssignmentsService, AssignmentRulesService],
  exports: [TaskAssignmentsService, AssignmentRulesService],
})
export class TaskAssignmentsModule {}
