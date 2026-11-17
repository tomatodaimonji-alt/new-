package jp.tsukacchi.sampleeditor;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;

/** Bundled starter + quietly refreshed, validated HTML from the project's pinned GitHub location. */
public final class MainActivity extends Activity {
 private static final String UPDATE_URL =
     "https://raw.githubusercontent.com/tomatodaimonji-alt/new-/main/sample-editor/index.html";
 private static final int MAX_BYTES=2*1024*1024;
 private WebView web;
 private File current;
 private volatile boolean checking=false;

 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().getDecorView().setSystemUiVisibility(
    View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|
    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|
    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
  current=new File(getFilesDir(),"sample-editor-current.html");
  web=new WebView(this);
  WebSettings settings=web.getSettings();
  settings.setJavaScriptEnabled(true);
  settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(true);
  settings.setAllowFileAccessFromFileURLs(false);
  settings.setAllowUniversalAccessFromFileURLs(false);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setOverScrollMode(View.OVER_SCROLL_NEVER);
  setContentView(web);
  loadCurrent();
  checkForUpdate();
 }
 private static byte[] readFile(File f) throws IOException{
  try(InputStream in=new FileInputStream(f);ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] buf=new byte[8192];int n,total=0;
   while((n=in.read(buf))!=-1){total+=n;if(total>MAX_BYTES)throw new IOException("Too large");out.write(buf,0,n);}
   return out.toByteArray();
  }
 }
 private boolean valid(File f) {
  if(!f.isFile()||f.length()<1000||f.length()>MAX_BYTES)return false;
  try{
   String html=new String(readFile(f),StandardCharsets.UTF_8);
   return html.contains("<title>サンプルエディター</title>") &&
     html.contains("id=\"v\"") && html.contains("id=\"scene\"") &&
     html.contains("requestAnimationFrame(frame)") && html.contains("</html>");
  }catch(IOException e){return false;}
 }
 private void loadCurrent(){
  if(valid(current))web.loadUrl("file://"+current.getAbsolutePath());
  else web.loadUrl("file:///android_asset/index.html");
 }
 private void checkForUpdate(){
  if(checking)return;
  checking=true;
  new Thread(()->{
   File temp=new File(getFilesDir(),"sample-editor-pending.html");
   HttpURLConnection conn=null;
   try{
    conn=(HttpURLConnection)new URL(UPDATE_URL).openConnection();
    conn.setConnectTimeout(8000);conn.setReadTimeout(10000);
    conn.setRequestProperty("Accept","text/html");
    conn.setInstanceFollowRedirects(false);
    if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
    int declared=conn.getContentLength();
    if(declared>MAX_BYTES)throw new IOException("Update too large");
    int size=0;
    try(InputStream input=conn.getInputStream();FileOutputStream output=new FileOutputStream(temp)){
     byte[] buf=new byte[8192];int n;
     while((n=input.read(buf))!=-1){
      size+=n;if(size>MAX_BYTES)throw new IOException("Update too large");
      output.write(buf,0,n);
     }
     output.getFD().sync();
    }
    if(!valid(temp))throw new IOException("Invalid update");
    if(valid(current)&&java.util.Arrays.equals(
      readFile(current),readFile(temp))){
      temp.delete();return;
    }
    // Staged replacement: never remove the last known-good version before validation.
    File previous=new File(getFilesDir(),"sample-editor-previous.html");
    if(previous.exists())previous.delete();
    if(current.exists()&&!current.renameTo(previous))
      throw new IOException("Could not keep previous version");
    if(!temp.renameTo(current)){
      if(previous.exists())previous.renameTo(current);
      throw new IOException("Could not activate update");
    }
    // Changes are applied on the next launch, avoiding interruptions mid-walk.
   }catch(Exception e){
    android.util.Log.w("SampleEditor","Update unavailable: "+e.getMessage());
   }finally{
    temp.delete();
    if(conn!=null)conn.disconnect();
    checking=false;
   }
  },"sample-editor-updater").start();
 }
 @Override protected void onResume(){super.onResume();if(web!=null&&current!=null)checkForUpdate();}
 @Override public void onBackPressed(){moveTaskToBack(true);}
 @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
