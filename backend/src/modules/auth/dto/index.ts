import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString()
  @MinLength(2, { message: '用户名至少2个字符' })
  @MaxLength(50, { message: '用户名最多50个字符' })
  name: string;

  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(64, { message: '密码最多64个字符' })
  password: string;

  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code: string;
}

export class LoginDto {
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  password: string;
}

export class SendCodeDto {
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsNotEmpty({ message: '场景不能为空' })
  @IsString()
  @Matches(/^(register|reset)$/, { message: '场景只能是 register 或 reset' })
  scene: 'register' | 'reset';
}

export class ResetPasswordDto {
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsNotEmpty({ message: '新密码不能为空' })
  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(64, { message: '密码最多64个字符' })
  newPassword: string;

  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code: string;
}
