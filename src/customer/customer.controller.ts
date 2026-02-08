import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';

@ApiTags('Admin - Kunden')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/customers')
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Kunden abrufen' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.customerService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Kunden-Statistiken' })
  async getStats() {
    return this.customerService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kunden-Details abrufen' })
  async findById(@Param('id') id: string) {
    return this.customerService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kunden manuell anlegen' })
  async create(
    @Body()
    body: {
      name: string;
      email: string;
      phone?: string;
      street?: string;
      postalCode?: string;
      city?: string;
      taxId?: string;
      notes?: string;
    },
  ) {
    return this.customerService.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Kunden aktualisieren' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.customerService.update(id, body);
  }
}
