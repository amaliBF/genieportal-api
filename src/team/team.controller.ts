import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { TeamService } from './team.service';
import { InviteTeamMemberDto } from './dto/invite-member.dto';
import { UpdateTeamMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Dashboard - Team')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/team')
export class TeamController {
  constructor(private teamService: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Teammitglieder auflisten' })
  async findAll(@CurrentUser('companyId') companyId: string) {
    return this.teamService.getTeamMembers(companyId);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Neues Teammitglied einladen' })
  async invite(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') companyUserId: string,
    @Body() dto: InviteTeamMemberDto,
  ) {
    return this.teamService.inviteMember(companyId, companyUserId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Teammitglied-Berechtigungen aktualisieren' })
  @ApiParam({ name: 'id', description: 'Teammitglied ID' })
  async update(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') companyUserId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamService.updateMember(companyId, id, companyUserId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Teammitglied entfernen' })
  @ApiParam({ name: 'id', description: 'Teammitglied ID' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') companyUserId: string,
  ) {
    return this.teamService.removeMember(companyId, id, companyUserId);
  }
}
