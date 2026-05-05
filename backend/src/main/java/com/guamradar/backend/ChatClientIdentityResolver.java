package com.guamradar.backend;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ChatClientIdentityResolver {
  private static final String DEFAULT_TRUSTED_PROXY_CIDRS = """
    127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,100.64.0.0/10
    """;

  private final boolean trustProxyHeaders;
  private final List<CidrBlock> trustedProxyCidrs;

  public ChatClientIdentityResolver(
    @Value("${chat.trust-proxy-headers:false}") boolean trustProxyHeaders,
    @Value("${chat.trusted-proxy-cidrs:" + DEFAULT_TRUSTED_PROXY_CIDRS + "}") String trustedProxyCidrs
  ) {
    this.trustProxyHeaders = trustProxyHeaders;
    this.trustedProxyCidrs = parseTrustedProxyCidrs(trustedProxyCidrs);
  }

  public String resolveClientIp(HttpServletRequest request) {
    String remoteAddress = normalizeIpLiteral(request.getRemoteAddr());
    if (remoteAddress == null || remoteAddress.isBlank()) {
      return "unknown";
    }

    if (!trustProxyHeaders || !isTrustedProxy(remoteAddress)) {
      return remoteAddress;
    }

    String forwardedClient = clientFromForwardedFor(request.getHeader("X-Forwarded-For"));
    if (forwardedClient != null) {
      return forwardedClient;
    }

    String realIp = normalizeIpLiteral(request.getHeader("X-Real-IP"));
    if (realIp != null) {
      return realIp;
    }

    return remoteAddress;
  }

  private String clientFromForwardedFor(String forwardedFor) {
    if (forwardedFor == null || forwardedFor.isBlank()) {
      return null;
    }

    String[] hops = forwardedFor.split(",");
    String firstValid = null;
    for (int i = hops.length - 1; i >= 0; i--) {
      String hop = normalizeIpLiteral(hops[i]);
      if (hop == null) continue;
      firstValid = hop;
      if (!isTrustedProxy(hop)) {
        return hop;
      }
    }

    return firstValid;
  }

  private boolean isTrustedProxy(String ip) {
    return trustedProxyCidrs.stream().anyMatch((cidr) -> cidr.contains(ip));
  }

  private List<CidrBlock> parseTrustedProxyCidrs(String value) {
    List<CidrBlock> blocks = new ArrayList<>();
    if (value == null || value.isBlank()) return blocks;

    for (String part : value.split(",")) {
      String cidr = part.trim();
      if (cidr.isBlank()) continue;
      CidrBlock block = CidrBlock.parse(cidr);
      if (block != null) {
        blocks.add(block);
      }
    }

    return blocks;
  }

  private static String normalizeIpLiteral(String value) {
    if (value == null) return null;

    String ip = value.trim();
    if (ip.isBlank() || ip.equalsIgnoreCase("unknown")) return null;

    if (ip.startsWith("[") && ip.contains("]")) {
      ip = ip.substring(1, ip.indexOf("]"));
    } else if (ip.indexOf(':') == ip.lastIndexOf(':') && ip.contains(".") && ip.contains(":")) {
      ip = ip.substring(0, ip.indexOf(':'));
    }

    if (!ip.matches("[0-9A-Fa-f:.%]+") || (!ip.contains(".") && !ip.contains(":"))) {
      return null;
    }

    try {
      InetAddress address = InetAddress.getByName(ip);
      return address.getHostAddress();
    } catch (UnknownHostException e) {
      return null;
    }
  }

  private record CidrBlock(InetAddress network, int prefixLength) {
    static CidrBlock parse(String value) {
      String[] parts = value.split("/");
      if (parts.length != 2) return null;

      String networkIp = normalizeIpLiteral(parts[0]);
      if (networkIp == null) return null;

      try {
        InetAddress network = InetAddress.getByName(networkIp);
        int prefixLength = Integer.parseInt(parts[1]);
        int maxBits = network.getAddress().length * 8;
        if (prefixLength < 0 || prefixLength > maxBits) return null;
        return new CidrBlock(network, prefixLength);
      } catch (Exception e) {
        return null;
      }
    }

    boolean contains(String ip) {
      String normalizedIp = normalizeIpLiteral(ip);
      if (normalizedIp == null) return false;

      try {
        byte[] addressBytes = InetAddress.getByName(normalizedIp).getAddress();
        byte[] networkBytes = network.getAddress();
        if (addressBytes.length != networkBytes.length) return false;

        int fullBytes = prefixLength / 8;
        int remainingBits = prefixLength % 8;

        for (int i = 0; i < fullBytes; i++) {
          if (addressBytes[i] != networkBytes[i]) return false;
        }

        if (remainingBits == 0) return true;

        int mask = 0xFF << (8 - remainingBits);
        return (addressBytes[fullBytes] & mask) == (networkBytes[fullBytes] & mask);
      } catch (UnknownHostException e) {
        return false;
      }
    }
  }
}
