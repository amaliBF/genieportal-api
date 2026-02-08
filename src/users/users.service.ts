import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ─── GET PROFILE ────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    // Exclude sensitive fields
    const {
      passwordHash,
      refreshToken,
      emailVerifyToken,
      passwordResetToken,
      passwordResetExpires,
      ...profile
    } = user;

    return profile;
  }

  // ─── UPDATE PROFILE ─────────────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    const data: Record<string, any> = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.birthDate !== undefined) data.birthDate = new Date(dto.birthDate);
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.interests !== undefined) data.interests = dto.interests;
    if (dto.strengths !== undefined) data.strengths = dto.strengths;
    if (dto.lookingFor !== undefined) data.lookingFor = dto.lookingFor;
    if (dto.currentSchoolType !== undefined)
      data.currentSchoolType = dto.currentSchoolType;
    if (dto.graduationYear !== undefined)
      data.graduationYear = dto.graduationYear;
    if (dto.maxDistanceKm !== undefined)
      data.maxDistanceKm = dto.maxDistanceKm;
    if (dto.preferredStartDate !== undefined)
      data.preferredStartDate = new Date(dto.preferredStartDate);
    if (dto.pushEnabled !== undefined) data.pushEnabled = dto.pushEnabled;
    if (dto.emailNotifications !== undefined)
      data.emailNotifications = dto.emailNotifications;
    if (dto.profileVisible !== undefined)
      data.profileVisible = dto.profileVisible;

    // Merge with existing values to calculate completeness accurately
    const merged = { ...existing, ...data };

    // Calculate completeness score based on key profile fields
    const keyFields = [
      merged.firstName != null && merged.firstName !== '',
      merged.postalCode != null && merged.postalCode !== '',
      merged.city != null && merged.city !== '',
      merged.bio != null && merged.bio !== '',
      Array.isArray(merged.interests)
        ? merged.interests.length > 0
        : merged.interests != null,
      merged.birthDate != null,
      merged.currentSchoolType != null && merged.currentSchoolType !== '',
    ];

    const filledCount = keyFields.filter(Boolean).length;
    const completenessScore = Math.round((filledCount / keyFields.length) * 100);
    const profileComplete = completenessScore >= 70;

    data.completenessScore = completenessScore;
    data.profileComplete = profileComplete;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    const {
      passwordHash,
      refreshToken,
      emailVerifyToken,
      passwordResetToken,
      passwordResetExpires,
      ...profile
    } = updated;

    return profile;
  }

  // ─── UPDATE LOCATION ───────────────────────────────────────────────────

  async updateLocation(
    userId: string,
    postalCode: string,
    city: string,
    lat?: number,
    lng?: number,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    const data: Record<string, any> = {
      postalCode,
      city,
    };

    if (lat !== undefined) data.latitude = lat;
    if (lng !== undefined) data.longitude = lng;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      postalCode: updated.postalCode,
      city: updated.city,
      latitude: updated.latitude,
      longitude: updated.longitude,
    };
  }

  // ─── UPDATE PREFERENCES ────────────────────────────────────────────────

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    const data: Record<string, any> = {};

    if (dto.preferredProfessions !== undefined)
      data.preferredProfessions = dto.preferredProfessions;
    if (dto.maxDistanceKm !== undefined)
      data.maxDistanceKm = dto.maxDistanceKm;
    if (dto.preferredStartDate !== undefined)
      data.preferredStartDate = new Date(dto.preferredStartDate);
    if (dto.pushEnabled !== undefined) data.pushEnabled = dto.pushEnabled;
    if (dto.emailNotifications !== undefined)
      data.emailNotifications = dto.emailNotifications;
    if (dto.profileVisible !== undefined)
      data.profileVisible = dto.profileVisible;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      preferredProfessions: updated.preferredProfessions,
      maxDistanceKm: updated.maxDistanceKm,
      preferredStartDate: updated.preferredStartDate,
      pushEnabled: updated.pushEnabled,
      emailNotifications: updated.emailNotifications,
      profileVisible: updated.profileVisible,
    };
  }

  // ─── BEREICHE ─────────────────────────────────────────────────────────

  async getBereiche(userId: string) {
    const bereiche = await this.prisma.userBereich.findMany({
      where: { userId },
      include: {
        portal: {
          select: {
            id: true,
            name: true,
            slug: true,
            farbe: true,
            icon: true,
            beschreibung: true,
          },
        },
      },
      orderBy: { portal: { id: 'asc' } },
    });

    return { bereiche };
  }

  async activateBereich(
    userId: string,
    portalId: number,
    profileData?: Record<string, any>,
  ) {
    const bereich = await this.prisma.userBereich.upsert({
      where: {
        userId_portalId: { userId, portalId },
      },
      update: {
        isActive: true,
        ...(profileData && { profileData }),
      },
      create: {
        userId,
        portalId,
        isActive: true,
        profileData: profileData || {},
      },
      include: {
        portal: {
          select: {
            id: true,
            name: true,
            slug: true,
            farbe: true,
            icon: true,
          },
        },
      },
    });

    return bereich;
  }

  async updateBereich(
    userId: string,
    portalId: number,
    profileData: Record<string, any>,
  ) {
    const existing = await this.prisma.userBereich.findUnique({
      where: { userId_portalId: { userId, portalId } },
    });

    if (!existing) {
      throw new NotFoundException('Bereich nicht aktiviert');
    }

    return this.prisma.userBereich.update({
      where: { userId_portalId: { userId, portalId } },
      data: { profileData },
      include: {
        portal: {
          select: {
            id: true,
            name: true,
            slug: true,
            farbe: true,
            icon: true,
          },
        },
      },
    });
  }

  async deactivateBereich(userId: string, portalId: number) {
    const existing = await this.prisma.userBereich.findUnique({
      where: { userId_portalId: { userId, portalId } },
    });

    if (!existing) {
      throw new NotFoundException('Bereich nicht aktiviert');
    }

    await this.prisma.userBereich.update({
      where: { userId_portalId: { userId, portalId } },
      data: { isActive: false },
    });

    return { message: 'Bereich deaktiviert' };
  }

  // ─── DELETE ACCOUNT (SOFT) ─────────────────────────────────────────────

  async deleteAccount(userId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        firstName: 'Gelöscht',
        lastName: null,
        displayName: null,
        phone: null,
        bio: null,
        interests: [],
        strengths: [],
        lookingFor: null,
        avatarUrl: null,
        birthDate: null,
        refreshToken: null,
        fcmToken: null,
        profileVisible: false,
      },
    });

    return { message: 'Account erfolgreich gelöscht' };
  }
}
