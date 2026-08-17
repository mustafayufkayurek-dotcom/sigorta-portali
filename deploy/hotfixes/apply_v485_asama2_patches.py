#!/usr/bin/env python3
"""v485 — yalnızca 2. aşama paket 4+5 yamaları. WIP kopyalanmaz."""
from __future__ import annotations

from pathlib import Path

APP = Path("/opt/app")


def must_replace(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"MISSING ANCHOR in {path}: {old[:80]!r}")
    if text.count(old) != 1 and "hover:bg-blue-700" not in old:
        # allow multi only for documented cases
        pass
    path.write_text(text.replace(old, new, 1 if text.count(old) == 1 else text.count(old)), encoding="utf-8")


def replace_all(path: Path, old: str, new: str) -> int:
    text = path.read_text(encoding="utf-8")
    n = text.count(old)
    if n == 0:
        raise SystemExit(f"MISSING {old!r} in {path}")
    path.write_text(text.replace(old, new), encoding="utf-8")
    return n


def patch_hover_brand() -> int:
    count = 0
    root = APP / "apps/web/src"
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix not in {".tsx", ".ts", ".css"}:
            continue
        if p.name == "MgmtHeader.tsx":
            continue
        text = p.read_text(encoding="utf-8")
        n = text.count("hover:bg-blue-700")
        if n:
            p.write_text(text.replace("hover:bg-blue-700", "hover:bg-brand-700"), encoding="utf-8")
            count += n
    return count


def main() -> None:
    # --- Paket 5: jwt guard ---
    guard = APP / "apps/backend/src/common/guards/jwt-auth.guard.ts"
    must_replace(
        guard,
        "import { TokenBlacklistService } from '@/modules/auth/token-blacklist.service';\n",
        "import { TokenBlacklistService } from '@/modules/auth/token-blacklist.service';\n"
        "import { extractAccessToken } from '@/common/auth/auth-cookies';\n",
    )
    must_replace(
        guard,
        "    const token = this.extractTokenFromHeader(request);",
        "    const token = extractAccessToken(request);",
    )
    must_replace(
        guard,
        """
  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
""",
        "}\n",
    )

    # --- Paket 5: auth controller ---
    auth = APP / "apps/backend/src/modules/auth/auth.controller.ts"
    must_replace(
        auth,
        "import { Controller, Post, Body, Get, Req } from '@nestjs/common';",
        "import { Controller, Post, Body, Get, Req, Res, UnauthorizedException } from '@nestjs/common';",
    )
    must_replace(
        auth,
        "import { Request } from 'express';",
        "import { Request, Response } from 'express';",
    )
    must_replace(
        auth,
        "import { TokenBlacklistService } from './token-blacklist.service';\n",
        "import { TokenBlacklistService } from './token-blacklist.service';\n"
        "import {\n"
        "  clearAuthCookies,\n"
        "  extractAccessToken,\n"
        "  extractRefreshToken,\n"
        "  setAuthCookies,\n"
        "} from '@/common/auth/auth-cookies';\n",
    )
    must_replace(
        auth,
        """  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      success: true,
      data: result,
    };
  }""",
        """  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);
    if (result?.tokens?.accessToken && result?.tokens?.refreshToken) {
      setAuthCookies(request, response, result.tokens);
    }
    return {
      success: true,
      data: result,
    };
  }""",
    )
    must_replace(
        auth,
        """  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const tokens = await this.authService.refresh(refreshTokenDto.refreshToken);
    return {
      success: true,
      data: tokens,
    };
  }""",
        """  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = extractRefreshToken(request, refreshTokenDto?.refreshToken);
    if (!refreshToken) {
      throw new UnauthorizedException('Token bulunamadı');
    }
    const tokens = await this.authService.refresh(refreshToken);
    setAuthCookies(request, response, tokens);
    return {
      success: true,
      data: tokens,
    };
  }""",
    )
    must_replace(
        auth,
        """  async logout(
    @CurrentUser() user: any,
    @Req() request: Request,
    @Body() body: { refreshToken?: string },
  ) {
    const auth = request.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token) {
      const decoded = this.jwtService.decode(token) as { exp?: number } | null;
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded?.exp ? decoded.exp - now : 0;
      if (ttl > 0) {
        await this.tokenBlacklistService.blacklist(token, ttl);
      }
    }
    if (body?.refreshToken) {
      await this.authService.logout(user.id, body.refreshToken);
    }
    return {
      success: true,
      message: 'Çıkış yapıldı',
    };
  }""",
        """  async logout(
    @CurrentUser() user: any,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: { refreshToken?: string },
  ) {
    const token = extractAccessToken(request) || '';
    if (token) {
      const decoded = this.jwtService.decode(token) as { exp?: number } | null;
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded?.exp ? decoded.exp - now : 0;
      if (ttl > 0) {
        await this.tokenBlacklistService.blacklist(token, ttl);
      }
    }
    const refreshToken = extractRefreshToken(request, body?.refreshToken);
    if (refreshToken) {
      await this.authService.logout(user.id, refreshToken);
    }
    clearAuthCookies(request, response);
    return {
      success: true,
      message: 'Çıkış yapıldı',
    };
  }""",
    )

    # --- Paket 5: main.ts uploads auth ---
    main_ts = APP / "apps/backend/src/main.ts"
    must_replace(
        main_ts,
        "import { NestFactory } from '@nestjs/core';\nimport { ValidationPipe } from '@nestjs/common';\n",
        "import { NestFactory } from '@nestjs/core';\nimport { ValidationPipe } from '@nestjs/common';\n"
        "import { JwtService } from '@nestjs/jwt';\n",
    )
    must_replace(
        main_ts,
        "import { getUploadsRootDir } from './modules/repair-reports/report-image-paths';\n",
        "import { getUploadsRootDir } from './modules/repair-reports/report-image-paths';\n"
        "import { TokenBlacklistService } from './modules/auth/token-blacklist.service';\n"
        "import { createUploadsAuthMiddleware } from './common/middleware/uploads-auth.middleware';\n",
    )
    must_replace(
        main_ts,
        """  // Static file serving for uploads — report-images ile aynı kalıcı kök
  app.useStaticAssets(getUploadsRootDir(), {
    prefix: '/uploads',
    setHeaders: (res: any) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', process.env.WEB_URL || 'http://localhost:3001');
    },
  });
""",
        """  const jwt = app.get(JwtService);
  const tokenBlacklist = app.get(TokenBlacklistService);
  const webOrigin = process.env.WEB_URL || 'http://localhost:3001';

  app.use(
    '/uploads',
    createUploadsAuthMiddleware({
      verify: (token) => jwt.verifyAsync(token, { secret: process.env.JWT_SECRET }),
      isBlacklisted: (token) => tokenBlacklist.isBlacklisted(token),
    }),
  );

  // Static file serving for uploads — report-images ile aynı kalıcı kök
  app.useStaticAssets(getUploadsRootDir(), {
    prefix: '/uploads',
    setHeaders: (res: any) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', webOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Cache-Control', 'private, max-age=604800');
    },
  });
""",
    )

    # --- Paket 5: storage path ---
    storage = APP / "apps/backend/src/modules/storage/storage.service.ts"
    storage_text = storage.read_text(encoding="utf-8")
    path_import = "import { resolveSafeLocalPath } from './storage-path';\n"
    if path_import not in storage_text:
        s3_anchor = "} from './storage-s3-errors';\n"
        path_anchor = "import * as path from 'path';\n"
        if s3_anchor in storage_text:
            storage.write_text(storage_text.replace(s3_anchor, s3_anchor + path_import, 1), encoding="utf-8")
        elif path_anchor in storage_text:
            storage.write_text(storage_text.replace(path_anchor, path_anchor + path_import, 1), encoding="utf-8")
        else:
            raise SystemExit("storage.service.ts: cannot insert storage-path import")
    n = replace_all(storage, "const filePath = path.join(this.localUploadsDir, key);", "const filePath = resolveSafeLocalPath(this.localUploadsDir, key);")
    if n != 4:
        raise SystemExit(f"expected 4 local path joins, got {n}")

    # --- Paket 5: users whitelist ---
    users = APP / "apps/backend/src/modules/users/users.service.ts"
    users_text = users.read_text(encoding="utf-8")
    pick_import = "import { pickUserWriteScalars } from './user-update-fields';\n"
    if pick_import not in users_text:
        marker = "import { randomInt } from 'crypto';\n"
        if marker not in users_text:
            raise SystemExit("users.service.ts: randomInt import missing")
        users.write_text(users_text.replace(marker, marker + pick_import, 1), encoding="utf-8")
    must_replace(
        users,
        """    const {
      password,
      departmentMemberships,
      responsibilityAssignments,
      serviceAreas,
      insuranceCompanyIds,
      assistantCustomerIds,
      expertCustomerId,
      brokerCustomerId,
      ...rest
    } = data;
""",
        """    const {
      password,
      departmentMemberships,
      responsibilityAssignments,
      serviceAreas,
      insuranceCompanyIds,
      assistantCustomerIds,
      expertCustomerId,
      brokerCustomerId,
    } = data;
    const rest: any = pickUserWriteScalars(data);
""",
    )
    must_replace(
        users,
        """    const {
      password,
      oldPassword,
      departmentMemberships,
      responsibilityAssignments,
      serviceAreas,
      insuranceCompanyIds,
      assistantCustomerIds,
      expertCustomerId,
      brokerCustomerId,
      ...rest
    } = data;
""",
        """    const {
      password,
      oldPassword,
      departmentMemberships,
      responsibilityAssignments,
      serviceAreas,
      insuranceCompanyIds,
      assistantCustomerIds,
      expertCustomerId,
      brokerCustomerId,
    } = data;
    const rest: any = pickUserWriteScalars(data);
""",
    )

    # --- Paket 5: next rewrite ---
    nxt = APP / "apps/web/next.config.js"
    must_replace(
        nxt,
        """      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
""",
        """      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backend}/uploads/:path*`,
      },
""",
    )

    # --- Paket 5: web credentials ---
    api = APP / "apps/web/src/utils/api.ts"
    must_replace(
        api,
        "export const API = _base.endsWith('/api/v1') ? _base : `${_base}/api/v1`;\n",
        "export const API = _base.endsWith('/api/v1') ? _base : `${_base}/api/v1`;\n\n"
        "axios.defaults.withCredentials = true;\n",
    )
    must_replace(api, "  let response = await fetch(url, { ...init, headers });", "  let response = await fetch(url, { ...init, headers, credentials: 'include' });")
    must_replace(
        api,
        """        const refreshed = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });""",
        """        const refreshed = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ refreshToken }),
        });""",
    )
    must_replace(
        api,
        """          response = await fetch(url, {
            ...init,
            headers: {
              ...headers,
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          });""",
        """          response = await fetch(url, {
            ...init,
            credentials: 'include',
            headers: {
              ...headers,
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          });""",
    )
    must_replace(
        api,
        """  const requestConfig: AxiosRequestConfig = {
    ...config,
    headers: {
      ...config.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };""",
        """  const requestConfig: AxiosRequestConfig = {
    ...config,
    withCredentials: true,
    headers: {
      ...config.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };""",
    )

    client = APP / "apps/web/src/lib/api-client.ts"
    must_replace(client, "  let response = await fetch(finalUrl, { ...init, headers });", "  let response = await fetch(finalUrl, { ...init, headers, credentials: 'include' });")
    must_replace(
        client,
        """        const refreshed = await fetch(`${apiBase}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });""",
        """        const refreshed = await fetch(`${apiBase}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ refreshToken }),
        });""",
    )
    must_replace(
        client,
        """          response = await fetch(finalUrl, {
            ...init,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokens.accessToken}`,
              ...(init.headers ?? {}),
            },
          });""",
        """          response = await fetch(finalUrl, {
            ...init,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokens.accessToken}`,
              ...(init.headers ?? {}),
            },
          });""",
    )

    sess = APP / "apps/web/src/utils/auth-session.ts"
    must_replace(
        sess,
        """    await axios.get(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });""",
        """    await axios.get(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    });""",
    )
    must_replace(
        sess,
        "      const refreshed = await axios.post(`${base}/auth/refresh`, { refreshToken });",
        "      const refreshed = await axios.post(`${base}/auth/refresh`, { refreshToken }, { withCredentials: true });",
    )
    must_replace(
        sess,
        """        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 8000,
        },""",
        """        {
          headers: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true,
          timeout: 8000,
        },""",
    )

    giris = APP / "apps/web/src/app/giris/page.tsx"
    must_replace(
        giris,
        """      const response = await axios.post(`${API_URL}/auth/login`, {
        email: normalizedEmail,
        password,
      });""",
        """      const response = await axios.post(
        `${API_URL}/auth/login`,
        {
          email: normalizedEmail,
          password,
        },
        { withCredentials: true },
      );""",
    )

    # --- Paket 4: hover + CTA ---
    hover_n = patch_hover_brand()
    header = APP / "apps/web/src/app/panel/_components/dashboard-header.tsx"
    must_replace(
        header,
        'className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:gap-2 sm:px-3 sm:text-sm"',
        'className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700 sm:gap-2 sm:px-3 sm:text-sm"',
    )
    finans = APP / "apps/web/src/app/panel/finans/page.tsx"
    must_replace(
        finans,
        'className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"',
        'className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"',
    )
    crm = APP / "apps/web/src/app/panel/crm/page.tsx"
    must_replace(
        crm,
        'className="self-end inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"',
        'className="self-end inline-flex h-9 items-center justify-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"',
    )
    pdf = APP / "apps/web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx"
    must_replace(
        pdf,
        'className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1"',
        'className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 flex items-center gap-1"',
    )

    # Prod şemasında User.vendorId yok — yazma listesinden çıkar
    ufields = APP / "apps/backend/src/modules/users/user-update-fields.ts"
    uf = ufields.read_text(encoding="utf-8")
    uf2 = uf.replace("  'vendorId',\n", "")
    if uf2 == uf:
        raise SystemExit("vendorId strip failed in user-update-fields.ts")
    ufields.write_text(uf2, encoding="utf-8")

    print(f"v485 patches OK hover_replacements={hover_n}")


if __name__ == "__main__":
    main()
