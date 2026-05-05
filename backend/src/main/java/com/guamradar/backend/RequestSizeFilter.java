package com.guamradar.backend;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestSizeFilter extends OncePerRequestFilter {
  private final long maxRequestBytes;

  public RequestSizeFilter(@Value("${CHAT_MAX_REQUEST_BYTES:65536}") long maxRequestBytes) {
    this.maxRequestBytes = Math.max(1024, maxRequestBytes);
  }

  @Override
  protected void doFilterInternal(
    HttpServletRequest request,
    HttpServletResponse response,
    FilterChain filterChain
  ) throws ServletException, IOException {
    if (isChatRequest(request) && request.getContentLengthLong() > maxRequestBytes) {
      response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
      response.setContentType("application/json");
      response.getWriter().write("""
        {"code":"request_too_large","error":"This chat request is too large. Please shorten it."}
        """.trim());
      return;
    }

    filterChain.doFilter(request, response);
  }

  private boolean isChatRequest(HttpServletRequest request) {
    String path = request.getRequestURI();
    return path.equals("/api/chat") || path.equals("/api/chat/stream");
  }
}
