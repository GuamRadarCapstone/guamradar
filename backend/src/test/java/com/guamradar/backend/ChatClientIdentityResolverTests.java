package com.guamradar.backend;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ChatClientIdentityResolverTests {
  @Test
  void ignoresForwardedHeadersByDefault() {
    ChatClientIdentityResolver resolver = new ChatClientIdentityResolver(false, "127.0.0.1/32");
    MockHttpServletRequest request = request("203.0.113.10");
    request.addHeader("X-Forwarded-For", "198.51.100.5");

    assertThat(resolver.resolveClientIp(request)).isEqualTo("203.0.113.10");
  }

  @Test
  void ignoresForwardedHeadersFromUntrustedPeer() {
    ChatClientIdentityResolver resolver = new ChatClientIdentityResolver(true, "127.0.0.1/32");
    MockHttpServletRequest request = request("203.0.113.10");
    request.addHeader("X-Forwarded-For", "198.51.100.5");

    assertThat(resolver.resolveClientIp(request)).isEqualTo("203.0.113.10");
  }

  @Test
  void usesForwardedHeaderFromTrustedPeer() {
    ChatClientIdentityResolver resolver = new ChatClientIdentityResolver(true, "10.0.0.0/8");
    MockHttpServletRequest request = request("10.0.4.20");
    request.addHeader("X-Forwarded-For", "198.51.100.5");

    assertThat(resolver.resolveClientIp(request)).isEqualTo("198.51.100.5");
  }

  @Test
  void resistsSpoofedLeftMostForwardedHopWhenProxyAppends() {
    ChatClientIdentityResolver resolver = new ChatClientIdentityResolver(true, "10.0.0.0/8");
    MockHttpServletRequest request = request("10.0.4.20");
    request.addHeader("X-Forwarded-For", "192.0.2.99, 198.51.100.5, 10.0.9.10");

    assertThat(resolver.resolveClientIp(request)).isEqualTo("198.51.100.5");
  }

  @Test
  void fallsBackToRealIpWhenForwardedForIsInvalid() {
    ChatClientIdentityResolver resolver = new ChatClientIdentityResolver(true, "10.0.0.0/8");
    MockHttpServletRequest request = request("10.0.4.20");
    request.addHeader("X-Forwarded-For", "unknown");
    request.addHeader("X-Real-IP", "198.51.100.8");

    assertThat(resolver.resolveClientIp(request)).isEqualTo("198.51.100.8");
  }

  private MockHttpServletRequest request(String remoteAddress) {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setRemoteAddr(remoteAddress);
    return request;
  }
}
