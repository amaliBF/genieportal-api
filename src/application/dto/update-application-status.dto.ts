import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsString()
  status: string;
}

export class UpdateApplicationNotesDto {
  @IsString()
  interneNotizen: string;
}

export class UpdateApplicationRatingDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}
