import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteTeamMemberDto } from './dto/invite-member.dto';
import { UpdateTeamMemberDto } from './dto/update-member.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  // ─── LIST TEAM MEMBERS ──────────────────────────────────────────────────

  async getTeamMembers(companyId: string) {
    return this.prisma.companyUser.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        canEditProfile: true,
        canManageJobs: true,
        canChat: true,
        canManageTeam: true,
        canManageBilling: true,
        emailVerified: true,
        invitedAt: true,
        joinedAt: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  // ─── INVITE A NEW TEAM MEMBER ───────────────────────────────────────────

  async inviteMember(
    companyId: string,
    invitedById: string,
    dto: InviteTeamMemberDto,
  ) {
    // Check that the inviter has permission to manage the team
    const inviter = await this.prisma.companyUser.findUnique({
      where: { id: invitedById },
    });

    if (!inviter || inviter.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    if (!inviter.canManageTeam && inviter.role !== 'owner') {
      throw new ForbiddenException(
        'Sie haben keine Berechtigung, Teammitglieder einzuladen',
      );
    }

    // Check for duplicate email within the same company
    const existing = await this.prisma.companyUser.findUnique({
      where: {
        companyId_email: {
          companyId,
          email: dto.email,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits in diesem Unternehmen',
      );
    }

    // Generate a random temporary password and hash it
    const tempPassword = uuidv4().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Generate an email verification token
    const emailVerifyToken = uuidv4();

    const member = await this.prisma.companyUser.create({
      data: {
        companyId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        role: dto.role ?? 'member',
        canEditProfile: dto.canEditProfile ?? false,
        canManageJobs: dto.canManageJobs ?? true,
        canChat: dto.canChat ?? true,
        canManageTeam: dto.canManageTeam ?? false,
        canManageBilling: dto.canManageBilling ?? false,
        emailVerifyToken,
        invitedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        canEditProfile: true,
        canManageJobs: true,
        canChat: true,
        canManageTeam: true,
        canManageBilling: true,
        emailVerified: true,
        invitedAt: true,
        createdAt: true,
      },
    });

    return member;
  }

  // ─── UPDATE A TEAM MEMBER ──────────────────────────────────────────────

  async updateMember(
    companyId: string,
    memberId: string,
    updaterId: string,
    dto: UpdateTeamMemberDto,
  ) {
    // Cannot change your own role/permissions
    if (memberId === updaterId) {
      throw new ForbiddenException(
        'Sie koennen Ihre eigenen Berechtigungen nicht aendern',
      );
    }

    const [updater, member] = await Promise.all([
      this.prisma.companyUser.findUnique({ where: { id: updaterId } }),
      this.prisma.companyUser.findUnique({ where: { id: memberId } }),
    ]);

    if (!updater || updater.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    if (!updater.canManageTeam && updater.role !== 'owner') {
      throw new ForbiddenException(
        'Sie haben keine Berechtigung, Teammitglieder zu bearbeiten',
      );
    }

    if (!member || member.companyId !== companyId) {
      throw new NotFoundException('Teammitglied nicht gefunden');
    }

    // Cannot change the owner's role or permissions
    if (member.role === 'owner') {
      throw new ForbiddenException(
        'Die Berechtigungen des Inhabers koennen nicht geaendert werden',
      );
    }

    return this.prisma.companyUser.update({
      where: { id: memberId },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.canEditProfile !== undefined && { canEditProfile: dto.canEditProfile }),
        ...(dto.canManageJobs !== undefined && { canManageJobs: dto.canManageJobs }),
        ...(dto.canChat !== undefined && { canChat: dto.canChat }),
        ...(dto.canManageTeam !== undefined && { canManageTeam: dto.canManageTeam }),
        ...(dto.canManageBilling !== undefined && { canManageBilling: dto.canManageBilling }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        canEditProfile: true,
        canManageJobs: true,
        canChat: true,
        canManageTeam: true,
        canManageBilling: true,
        emailVerified: true,
        invitedAt: true,
        joinedAt: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  }

  // ─── REMOVE A TEAM MEMBER ─────────────────────────────────────────────

  async removeMember(
    companyId: string,
    memberId: string,
    removerId: string,
  ) {
    // Cannot remove yourself
    if (memberId === removerId) {
      throw new ForbiddenException(
        'Sie koennen sich nicht selbst entfernen',
      );
    }

    const [remover, member] = await Promise.all([
      this.prisma.companyUser.findUnique({ where: { id: removerId } }),
      this.prisma.companyUser.findUnique({ where: { id: memberId } }),
    ]);

    if (!remover || remover.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    if (!remover.canManageTeam && remover.role !== 'owner') {
      throw new ForbiddenException(
        'Sie haben keine Berechtigung, Teammitglieder zu entfernen',
      );
    }

    if (!member || member.companyId !== companyId) {
      throw new NotFoundException('Teammitglied nicht gefunden');
    }

    // Cannot remove the owner
    if (member.role === 'owner') {
      throw new ForbiddenException(
        'Der Inhaber kann nicht entfernt werden',
      );
    }

    await this.prisma.companyUser.delete({
      where: { id: memberId },
    });

    return { message: 'Teammitglied erfolgreich entfernt' };
  }
}
